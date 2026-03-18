
import { User, ContentPost, SystemConfig } from "@/lib/types";
import { doc, runTransaction, collection } from "firebase/firestore";
import { db } from "./firebase";
import { getSystemConfig } from "./ledger"; // Import the config getter

export const handleUnlock = async (user: User, post: ContentPost) => {
    if (!user.walletAddress) {
        throw new Error("User wallet not connected.");
    }

    if (user.uid === post.creatorId) {
        throw new Error("Creator cannot unlock their own post.");
    }

    const price = post.unlockPrice || 0;
    if (price <= 0) {
        throw new Error("This content is free or has an invalid price.");
    }
    const referenceId = `unlock_${post.id}_${user.uid}`;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "User not found.";
            
            const userData = userSnap.data() as User;
            // Balance check now uses the correct field
            if ((userData.ulcBalance?.available || 0) < price) {
                throw new Error("Insufficient ULC balance to unlock the post.");
            }

            const config = await getSystemConfig();
            
            // --- Commission Split Logic ---
            const stakingRatio = config.premium_commission_staking_ratio || 0.025;
            const treasuryRatio = config.premium_commission_treasury_ratio || 0.025;
            
            const stakingShare = price * stakingRatio;
            const treasuryShare = price * treasuryRatio;
            const creatorShare = price - stakingShare - treasuryShare;

            if (creatorShare <= 0) {
                throw new Error("Invalid commission split resulted in non-positive creator share.");
            }

            const batch = [];
            const ledgerCollection = collection(db, "ledger");

            // 1. Debit from User
            batch.push({
                ref: doc(ledgerCollection),
                data: {
                    fromUserId: user.uid,
                    fromWallet: user.walletAddress,
                    amount: price,
                    currency: "ULC",
                    type: "premium_unlock",
                    referenceId,
                    metadata: { postId: post.id, details: "User payment for premium content" },
                    timestamp: Date.now()
                }
            });

            // 2. Credit Creator's Share
            batch.push({
                ref: doc(ledgerCollection),
                data: {
                    toUserId: post.creatorId,
                    amount: creatorShare,
                    currency: "ULC",
                    type: "creator_earning",
                    referenceId,
                    metadata: { postId: post.id, from: user.uid },
                    timestamp: Date.now()
                }
            });

            // 3. Credit Staking Pool Share
            batch.push({
                ref: doc(ledgerCollection),
                data: {
                    toWallet: config.staking_pool_wallet,
                    amount: stakingShare,
                    currency: "ULC",
                    type: "staking_reward",
                    referenceId,
                    metadata: { postId: post.id, details: "Commission fee for staking pool" },
                    timestamp: Date.now()
                }
            });

            // 4. Credit Treasury Share
            batch.push({
                ref: doc(ledgerCollection),
                data: {
                    toWallet: config.treasury_wallet,
                    amount: treasuryShare,
                    currency: "ULC",
                    type: "treasury_fee",
                    referenceId,
                    metadata: { postId: post.id, details: "Commission fee for treasury" },
                    timestamp: Date.now()
                }
            });
            
            // Execute all ledger writes
            for (const op of batch) {
                transaction.set(op.ref, op.data);
            }
            
            // Note: We are no longer updating user balances directly.
            // Balances should be computed from the ledger by a separate process/trigger.
        });

    } catch (error: any) {
        console.error("Unlock transaction failed: ", error);
        throw new Error(error.message || "Could not complete the unlock process.");
    }
};

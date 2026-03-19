
import { UserProfile, ContentPost, SystemConfig } from "@/lib/types";
import { doc, runTransaction, collection, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";
import { getSystemConfig } from "./ledger";

/**
 * Executes the Premium/Limited Unlock logic using ULC.
 * Split: 85% Creator, 10% Treasury, 5% Staking Pool.
 */
export const handleUnlock = async (user: UserProfile, post: ContentPost) => {
    if (!user.walletAddress) throw new Error("User wallet not connected.");
    if (user.uid === post.creatorId) throw new Error("Creator cannot unlock their own post.");
    if (user.unlockedPostIds?.includes(post.id)) throw new Error("Already unlocked.");

    // Determine price based on content type
    const price = post.contentType === 'limited' ? (post.limited?.price || 0) : (post.unlockPrice || 0);
    
    if (price <= 0) throw new Error("Invalid price for unlock.");

    const referenceId = `unlock_${post.id}_${user.uid}`;

    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("User profile not found.");
            
            const userData = userSnap.data() as UserProfile;
            
            // 1. Balance Check
            if ((userData.ulcBalance?.available || 0) < price) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            // 2. Limited Edition Check (if applicable)
            if (post.contentType === 'limited' && post.limited) {
                if (post.limited.soldCount >= post.limited.totalSupply) {
                    throw new Error("This item is sold out.");
                }
            }

            const config = await getSystemConfig();
            
            // --- 85/15 Split Logic ---
            const platformRatio = 0.15;
            const treasuryShareRatio = 0.10 / platformRatio; // 10% of total price
            const stakingShareRatio = 0.05 / platformRatio;  // 5% of total price
            
            const totalFee = price * platformRatio;
            const creatorShare = price - totalFee;
            const treasuryShare = totalFee * treasuryShareRatio;
            const stakingShare = totalFee * stakingShareRatio;

            const ledgerCollection = collection(db, "ledger");

            // Ledger 1: User Debit (Total Price)
            transaction.set(doc(ledgerCollection), {
                fromUserId: user.uid,
                fromWallet: user.walletAddress,
                amount: price,
                currency: "ULC",
                type: "premium_unlock",
                referenceId,
                metadata: { postId: post.id, contentType: post.contentType },
                timestamp: Date.now()
            });

            // Ledger 2: Creator Credit (85%)
            transaction.set(doc(ledgerCollection), {
                toUserId: post.creatorId,
                amount: creatorShare,
                currency: "ULC",
                type: "creator_earning",
                referenceId,
                metadata: { postId: post.id, from: user.uid },
                timestamp: Date.now()
            });

            // Ledger 3: Platform Treasury (10%)
            transaction.set(doc(ledgerCollection), {
                toWallet: config.treasury_wallets?.TON || "SYSTEM_TREASURY", // Fallback
                amount: treasuryShare,
                currency: "ULC",
                type: "treasury_fee",
                referenceId,
                metadata: { postId: post.id },
                timestamp: Date.now()
            });

            // Ledger 4: Staking Pool (5%)
            transaction.set(doc(ledgerCollection), {
                toWallet: "SYSTEM_STAKING_POOL",
                amount: stakingShare,
                currency: "ULC",
                type: "staking_reward",
                referenceId,
                metadata: { postId: post.id },
                timestamp: Date.now()
            });

            // 3. Update User Profile (Atomic)
            transaction.update(userRef, {
                unlockedPostIds: arrayUnion(post.id),
                'ulcBalance.available': (userData.ulcBalance?.available || 0) - price,
                totalSpent: (userData.totalSpent || 0) + price
            });
            
            // 4. Update Post Stats (Atomic)
            const postRef = doc(db, 'posts', post.id);
            if (post.contentType === 'limited') {
                transaction.update(postRef, {
                    'limited.soldCount': (post.limited?.soldCount || 0) + 1,
                    unlockCount: (post.unlockCount || 0) + 1
                });
            } else {
                transaction.update(postRef, {
                    unlockCount: (post.unlockCount || 0) + 1
                });
            }
        });

    } catch (error: any) {
        console.error("Unlock transaction error:", error);
        throw error;
    }
};

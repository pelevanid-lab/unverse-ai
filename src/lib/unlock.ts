
import { UserProfile, ContentPost, SystemConfig } from "@/lib/types";
import { doc, runTransaction, collection, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";
import { getSystemConfig } from "./ledger";

export const handleUnlock = async (user: UserProfile, post: ContentPost) => {
    if (!user.walletAddress) {
        throw new Error("User wallet not connected.");
    }

    if (user.uid === post.creatorId) {
        throw new Error("Creator cannot unlock their own post.");
    }

    // Check if already unlocked locally before even starting the transaction
    if (user.unlockedPostIds?.includes(post.id)) {
        throw new Error("You have already unlocked this post.");
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
            if (!userSnap.exists()) throw new Error("User not found.");
            
            const userData = userSnap.data() as UserProfile;
            
            // Double check inside transaction for atomicity
            if (userData.unlockedPostIds?.includes(post.id)) {
                throw new Error("Post already unlocked.");
            }

            if ((userData.ulcBalance?.available || 0) < price) {
                throw new Error("Insufficient ULC balance.");
            }

            const config = await getSystemConfig();
            
            const stakingRatio = 0.025; // Default if config fails
            const treasuryRatio = 0.025;
            
            const stakingShare = price * stakingRatio;
            const treasuryShare = price * treasuryRatio;
            const creatorShare = price - stakingShare - treasuryShare;

            const ledgerCollection = collection(db, "ledger");

            // 1. Record User Debit
            transaction.set(doc(ledgerCollection), {
                fromUserId: user.uid,
                fromWallet: user.walletAddress,
                amount: price,
                currency: "ULC",
                type: "premium_unlock",
                referenceId,
                metadata: { postId: post.id },
                timestamp: Date.now()
            });

            // 2. Record Creator Credit
            transaction.set(doc(ledgerCollection), {
                toUserId: post.creatorId,
                amount: creatorShare,
                currency: "ULC",
                type: "creator_earning",
                referenceId,
                metadata: { postId: post.id, from: user.uid },
                timestamp: Date.now()
            });

            // 3. ATOMIC UPDATE: Add to User's Unlocked List
            // This prevents double purchasing
            transaction.update(userRef, {
                unlockedPostIds: arrayUnion(post.id),
                // Important: Also decrement balance here for immediate UI consistency
                'ulcBalance.available': (userData.ulcBalance?.available || 0) - price,
                totalSpent: (userData.totalSpent || 0) + price
            });
            
            // 4. Update Post Unlock Count
            const postRef = doc(db, 'posts', post.id);
            transaction.update(postRef, {
                unlockCount: (post.unlockCount || 0) + 1
            });
        });

    } catch (error: any) {
        console.error("Unlock transaction failed: ", error);
        throw new Error(error.message || "Could not complete the unlock process.");
    }
};


import { User, ContentPost } from "@/lib/types";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { toast } from "@/hooks/use-toast";

export const handleUnlock = async (user: User, post: ContentPost) => {
    if (!user.walletAddress) {
        throw new Error("User wallet not connected.");
    }

    if (user.uid === post.creatorId) {
        throw new Error("Creator cannot unlock their own post.");
    }

    const price = post.unlockPrice || 10; // Default price if not set

    try {
        await runTransaction(db, async (transaction) => {
            const userLedgerRef = doc(db, "ledger", `${user.uid}_${post.id}`);
            const creatorLedgerRef = doc(db, "ledger", `${post.creatorId}_${post.id}_${user.uid}`);
            
            const userRef = doc(db, "users", user.uid);
            const creatorRef = doc(db, "users", post.creatorId);

            const userSnap = await transaction.get(userRef);
            const creatorSnap = await transaction.get(creatorRef);
            
            if (!userSnap.exists() || !creatorSnap.exists()) {
                throw "User or creator not found.";
            }

            const userData = userSnap.data();
            const creatorData = creatorSnap.data();

            if (userData.balance < price) {
                throw new Error("Insufficient balance to unlock the post.");
            }

            // Deduct balance from user
            transaction.update(userRef, { balance: userData.balance - price });

            // Add balance to creator
            transaction.update(creatorRef, { balance: (creatorData.balance || 0) + price });
            
            // Create a ledger entry for the user
            transaction.set(userLedgerRef, {
                fromWallet: user.walletAddress,
                toWallet: creatorData.walletAddress,
                amount: price,
                type: "premium_unlock",
                referenceId: post.id,
                createdAt: serverTimestamp(),
                fromUid: user.uid,
                toUid: post.creatorId,
            });

        });
    } catch (error: any) {
        console.error("Unlock transaction failed: ", error);
        throw new Error(error.message || "Could not complete the unlock process.");
    }
};

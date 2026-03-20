import { UserProfile, ContentPost } from "@/lib/types";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Executes the Premium/Limited Unlock logic via secure Cloud Function.
 */
export const handleUnlock = async (user: UserProfile, post: ContentPost) => {
    if (!user.walletAddress) throw new Error("User wallet not connected.");
    
    const unlockFunction = httpsCallable(functions, 'unlockContent');
    
    try {
        const result = await unlockFunction({ postId: post.id });
        return result.data;
    } catch (error: any) {
        console.error("Unlock error:", error);
        // Handle specific Firebase HttpsErrors if needed
        if (error.code === 'failed-precondition' && error.message.includes('INSUFFICIENT_BALANCE')) {
            throw new Error("INSUFFICIENT_BALANCE");
        }
        throw error;
    }
};

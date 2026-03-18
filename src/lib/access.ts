
import { db } from './firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';

/**
 * Centralized Access Control System for Unverse
 */

export interface AccessStatus {
    hasAccess: boolean;
    reason?: 'not_subscribed' | 'sold_out' | 'insufficient_balance' | 'not_logged_in';
}

/**
 * Always returns true as public content has no gate.
 */
export const canAccessPublic = (): boolean => {
    return true;
};

/**
 * Checks if a user has an active subscription to a creator.
 * Logic: Match userId + creatorId in 'subscriptions' collection where expiresAt > now.
 */
export const checkSubscription = async (userId: string | undefined, creatorId: string): Promise<boolean> => {
    if (!userId) return false;
    
    // Check 'subscriptions' collection for active record
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(
        subscriptionsRef, 
        where('userId', '==', userId),
        where('creatorId', '==', creatorId),
        where('expiresAt', '>', Date.now()),
        limit(1)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
};

/**
 * Access logic for the Premium Section
 */
export const canAccessPremiumSection = async (userId: string | undefined, creatorId: string): Promise<AccessStatus> => {
    if (!userId) return { hasAccess: false, reason: 'not_logged_in' };
    
    const isSubscribed = await checkSubscription(userId, creatorId);
    
    return {
        hasAccess: isSubscribed,
        reason: isSubscribed ? undefined : 'not_subscribed'
    };
};

/**
 * Access logic for the Limited Section
 */
export const canAccessLimitedSection = async (userId: string | undefined, creatorId: string): Promise<AccessStatus> => {
    if (!userId) return { hasAccess: false, reason: 'not_logged_in' };
    
    const isSubscribed = await checkSubscription(userId, creatorId);
    
    return {
        hasAccess: isSubscribed,
        reason: isSubscribed ? undefined : 'not_subscribed'
    };
};

/**
 * Placeholder for future granular content access (e.g. specific premium unlock)
 */
export const canAccessContent = async (userId: string | undefined, postId: string): Promise<AccessStatus> => {
    // To be implemented with individual unlock logic
    return { hasAccess: false };
};

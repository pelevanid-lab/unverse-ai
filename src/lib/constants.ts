
/**
 * Global constants for the Unverse platform.
 */

// Safe default avatar (Identicon-based to avoid human faces/children)
export const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/identicon/svg?seed=unverse-default';

// Helper to get a unique identicon for a wallet address
export const getSafeDefaultAvatar = (seed: string) => {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
};

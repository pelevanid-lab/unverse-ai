import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';
import { UserProfile } from '@/lib/types';

/**
 * useWallet - Manages user authentication via WalletConnect (Web3Modal)
 * and syncs profile data with Firebase/Firestore.
 */
export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Web3Modal and Wagmi hooks
  const { open } = useWeb3Modal();
  const { address, isConnected, isDisconnected } = useAccount();
  const { disconnect } = useDisconnect();

  // Effect to handle Firebase authentication and user profile creation
  useEffect(() => {
    const handleAuthAndProfile = async () => {
      if (isConnected && address && !firebaseUser) {
        setLoading(true);
        try {
          // 1. Authenticate with Firebase Anonymously
          const userCredential = await signInAnonymously(auth);
          const fbUser = userCredential.user;

          // 2. Check if a user profile exists, or create a new one
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            // Create new profile if it doesn't exist
            const newUserProfile: UserProfile = {
              uid: fbUser.uid,
              walletAddress: address,
              username: `Explorer_${address.slice(2, 8)}`,
              bio: "New citizen of the Unverse.",
              avatar: `https://i.pravatar.cc/150?u=${address}`,
              ulcBalance: { available: 0, locked: 0, claimable: 0 },
              totalEarnings: 0,
              totalSpent: 0,
              isCreator: false,
              createdAt: Date.now(),
            };
            await setDoc(userRef, newUserProfile);
          } else {
            // If profile exists, ensure wallet address is up-to-date
            await updateDoc(userRef, { walletAddress: address });
          }
          // The onSnapshot listener will handle setting the user state
        } catch (error) {
          console.error('Firebase auth or profile creation failed:', error);
          // Disconnect wallet if Firebase operations fail
          disconnect();
        } finally {
          setLoading(false);
        }
      }
    };

    handleAuthAndProfile();
  }, [isConnected, address, firebaseUser, disconnect]);

  // Effect to listen for Firebase auth state changes and sync Firestore data
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        const unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as UserProfile);
          } else {
            setUser(null); // Profile was deleted or doesn't exist
          }
          setLoading(false);
        });
        return () => unsubscribeSnapshot();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Effect to handle wallet disconnection
  useEffect(() => {
    if (isDisconnected && firebaseUser) {
      // If wallet disconnects, sign out from Firebase as well
      auth.signOut();
    }
  }, [isDisconnected, firebaseUser]);

  // Main connect function to be called by UI
  const connectWallet = () => {
    open(); // This opens the Web3Modal
  };

  // Main disconnect function
  const disconnectWallet = () => {
    disconnect(); // This triggers the useEffect for cleanup
  };

  return {
    user,
    loading,
    connectWallet,
    disconnectWallet,
    isConnected: !!user && isConnected, // True only if both wallet and Firebase are connected
    walletAddress: user?.walletAddress || '',
    ulcBalance: user?.ulcBalance?.available || 0,
    lockedULC: user?.ulcBalance?.locked || 0,
    claimableULC: user?.ulcBalance?.claimable || 0,
  };
}

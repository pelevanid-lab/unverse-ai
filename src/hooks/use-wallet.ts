
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

/**
 * useWallet - Reusable hook for managing user session and real-time profile data.
 * Handles automatic profile creation and live balance synchronization via Firestore.
 */
export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        
        // Real-time listener for the user profile (balances, roles, etc.)
        const unsubscribeSnap = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            setUser(userSnap.data() as UserProfile);
            setLoading(false);
          } else {
            // Generate a deterministic mock wallet address for local testing/prototype
            const mockWallet = `0x${fbUser.uid.slice(0, 4)}${Math.random().toString(16).slice(2, 10)}`;
            const newUser: UserProfile = {
              uid: fbUser.uid,
              walletAddress: mockWallet,
              username: `Explorer_${fbUser.uid.slice(0, 5)}`,
              bio: "New citizen of the Unverse.",
              avatar: `https://picsum.photos/seed/${fbUser.uid}/200/200`,
              ulcBalance: { available: 100, locked: 0, claimable: 0 },
              totalEarnings: 0,
              totalSpent: 0,
              isCreator: false,
              createdAt: Date.now()
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
            setLoading(false);
          }
        });

        return () => unsubscribeSnap();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Auth Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    auth.signOut();
  };

  return { user, loading, connectWallet, disconnectWallet, isConnected: !!user };
}

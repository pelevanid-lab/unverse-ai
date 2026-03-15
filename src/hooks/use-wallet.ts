import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        
        const unsubscribeSnap = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            setUser(userSnap.data() as UserProfile);
            setLoading(false);
          } else {
            const mockWallet = `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 6)}`;
            const newUser: UserProfile = {
              uid: fbUser.uid,
              walletAddress: mockWallet,
              username: `User_${fbUser.uid.slice(0, 5)}`,
              bio: "Welcome to Unverse!",
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
      console.error(e);
    }
    setLoading(false);
  };

  const disconnectWallet = () => {
    auth.signOut();
  };

  return { user, loading, connectWallet, disconnectWallet, isConnected: !!user };
}

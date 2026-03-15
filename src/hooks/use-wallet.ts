"use client"

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';

export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUser(userSnap.data() as UserProfile);
        } else {
          // Initialize new user
          const mockWallet = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
          const newUser: UserProfile = {
            uid: fbUser.uid,
            walletAddress: mockWallet,
            username: `User_${fbUser.uid.slice(0, 5)}`,
            bio: "Welcome to Unverse!",
            avatar: `https://picsum.photos/seed/${fbUser.uid}/200/200`,
            ulcBalance: { available: 100, locked: 0, claimable: 0 }, // Starter tokens
            totalEarnings: 0,
            totalSpent: 0,
            isCreator: false,
            createdAt: Date.now()
          };
          await setDoc(userRef, newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
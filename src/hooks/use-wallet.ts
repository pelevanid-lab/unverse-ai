import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useDisconnect } from 'wagmi';
import { UserProfile } from '@/lib/types';

/**
 * useWallet - Manages user authentication via WalletConnect (Web3Modal)
 * and syncs profile data with Firebase/Firestore.
 * 
 * This hook enforces a "one user per wallet address" rule by using a lowercase wallet address
 * as the document ID in Firestore. It also includes logic to migrate old, duplicate,
 * or case-sensitive user profiles to the new, unique format.
 */
export function useWallet() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const { open } = useWeb3Modal();
  const { address: rawAddress, isConnected, isDisconnected } = useAccount();
  const { disconnect } = useDisconnect();
  
  // Standardize address to lowercase to prevent case-sensitivity issues.
  const address = rawAddress?.toLowerCase();

  // Effect 1: Manage the anonymous Firebase authentication session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
      } else {
        signInAnonymously(auth).catch(error => {
          console.error("Anonymous sign-in failed:", error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Effect 2: Core logic for finding, migrating, or creating user profiles.
  useEffect(() => {
    if (!address || !firebaseUser) {
      setUser(null);
      if (isDisconnected) setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(db, 'users', address);

    const findOrCreateProfile = async () => {
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        // Profile with lowercase address ID exists. All good.
        return;
      }
      
      // --- MIGRATION & CREATION LOGIC ---
      // Query for legacy profiles using both original and lowercase address.
      // This ensures we find profiles regardless of how they were stored.
      const legacyQuery = query(
        collection(db, 'users'),
        where('walletAddress', 'in', [address, rawAddress]),
        orderBy('createdAt', 'asc')
      );

      const legacyDocs = await getDocs(legacyQuery);

      if (!legacyDocs.empty) {
        // --- MIGRATE from Legacy ---
        console.log(`Found ${legacyDocs.size} legacy documents for wallet ${address}. Migrating...`);
        const oldestDoc = legacyDocs.docs[0];
        let userData = oldestDoc.data() as UserProfile;

        // Standardize data for the new document.
        userData.uid = address; // Use lowercase address as the unique ID.
        userData.walletAddress = address;

        const batch = writeBatch(db);
        batch.set(userDocRef, userData); // 1. Create the new, correct document.

        // 2. Delete all old legacy documents (including the one we migrated from).
        legacyDocs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Migration complete for ${address}.`);

      } else {
        // --- CREATE New Profile ---
        console.log(`No legacy profile found for ${address}. Creating a new one.`);
        const newUserProfile: UserProfile = {
          uid: address, // Use lowercase address
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
        await setDoc(userDocRef, newUserProfile);
      }
    };

    // Set up the real-time listener on the standardized document reference.
    const unsubscribeSnapshot = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setUser(snapshot.data() as UserProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    findOrCreateProfile().catch(error => {
      console.error("Error during find/create user profile:", error);
      setLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [address, rawAddress, firebaseUser, isDisconnected]);

  // Effect 3: Handle wallet disconnection.
  useEffect(() => {
    if (isDisconnected) {
      setUser(null);
    }
  }, [isDisconnected]);

  const connectWallet = () => open();
  const disconnectWallet = () => disconnect();

  return {
    user,
    loading,
    connectWallet,
    disconnectWallet,
    isConnected: !!user && isConnected,
    walletAddress: user?.walletAddress || '',
    rawAddress: rawAddress, // Expose the original, raw address
    ulcBalance: user?.ulcBalance?.available || 0,
    lockedULC: user?.ulcBalance?.locked || 0,
    claimableULC: user?.ulcBalance?.claimable || 0,
  };
}

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_WALLET = "0x7dc33501b07d6eb895749f78c23c5eadca4a16de";

async function findUserGlobally() {
  console.log("Searching all users for wallet:", TARGET_WALLET);
  
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log(`Total users in collection: ${snap.size}`);
    
    let found = false;
    snap.forEach(doc => {
      const data = doc.data();
      if (doc.id === TARGET_WALLET || data.walletAddress === TARGET_WALLET || data.uid === TARGET_WALLET) {
        found = true;
        console.log("MATCH FOUND!");
        console.log("Document ID:", doc.id);
        console.log("Data UID field:", data.uid);
        console.log("Data walletAddress field:", data.walletAddress);
        console.log("isCreator:", data.isCreator);
        console.log("creatorInFirst100Program:", data.creatorInFirst100Program);
      }
    });
    
    if (!found) {
      console.log("No match found in all users.");
    }

  } catch (error: any) {
    console.error("Search failed:", error.message);
  }
}

findUserGlobally();

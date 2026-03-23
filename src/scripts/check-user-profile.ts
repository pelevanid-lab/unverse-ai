import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

const TARGET_UID = "0x7dc33501b07d6eb895749f78c23c5eadca4a16de";

async function checkUser() {
  console.log(`Checking user with UID: ${TARGET_UID}`);

  try {
    // 1. Check by Document ID
    const userRef = doc(db, 'users', TARGET_UID);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log("SUCCESS: User document found by ID.");
      console.log("User Data:", JSON.stringify(userSnap.data(), null, 2));
    } else {
      console.log("FAILURE: User document NOT found by ID.");
      
      // 2. Search for any document where walletAddress matches
      console.log("Searching by walletAddress field...");
      const q = query(collection(db, 'users'), where('walletAddress', '==', TARGET_UID));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        console.log(`FOUND ${snap.size} user(s) with this walletAddress.`);
        snap.forEach(d => {
            console.log(`- Document ID: ${d.id}`);
            console.log(`  Data:`, JSON.stringify(d.data(), null, 2));
        });
        console.log("HYPOTHESIS: The Auth UID does not match the walletAddress used as Document ID.");
      } else {
        console.log("No user found with this walletAddress field either.");
      }
    }

  } catch (error: any) {
    console.error("Check failed:", error.message);
  }
}

checkUser();

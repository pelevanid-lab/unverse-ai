import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

async function checkScheduled() {
  console.log("Checking scheduled items...");
  const now = Date.now();
  console.log("Current Time (UTC):", new Date(now).toISOString());
  console.log("Current Timestamp:", now);

  try {
    // 1. Simple query (no index needed)
    const q1 = query(collection(db, 'creator_media'), where('status', '==', 'scheduled'));
    const snap1 = await getDocs(q1);
    console.log(`Found ${snap1.size} items with status 'scheduled'`);

    if (snap1.empty) {
        console.log("No scheduled items found at all.");
        return;
    }

    snap1.docs.forEach(doc => {
        const data = doc.data();
        const diff = data.scheduledFor - now;
        console.log(`- Item ${doc.id}: Scheduled for ${new Date(data.scheduledFor).toISOString()} (In ${diff / 1000 / 60} minutes)`);
    });

    // 2. Composite query (may require index)
    console.log("Attempting composite query...");
    const q2 = query(
      collection(db, 'creator_media'), 
      where('status', '==', 'scheduled'), 
      where('scheduledFor', '<=', now)
    );
    const snap2 = await getDocs(q2);
    console.log(`Composite query succeeded. Found ${snap2.size} items to publish.`);

  } catch (error: any) {
    console.error("Query failed!");
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
  }
}

checkScheduled();

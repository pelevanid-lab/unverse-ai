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

const TARGET = "0x7dc33501b07d6eb895749f78c23c5eadca4a16de";

async function checkFields() {
  const snap = await getDocs(collection(db, 'users'));
  snap.forEach(doc => {
    const data = doc.data();
    if (data.uid === TARGET) console.log(`UID_MATCH_IN_DOC:[${doc.id}]`);
    if (data.walletAddress === TARGET) console.log(`WALLET_MATCH_IN_DOC:[${doc.id}]`);
  });
}

checkFields();

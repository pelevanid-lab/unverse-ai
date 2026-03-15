import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKey_Please_Replace_In_Console",
  authDomain: "unverse-139974452713.firebaseapp.com",
  projectId: "unverse-139974452713",
  storageBucket: "unverse-139974452713.appspot.com",
  messagingSenderId: "139974452713",
  appId: "1:139974452713:web:a627e7f1c991206f345821"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

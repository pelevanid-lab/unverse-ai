import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace this entire object with your project's Firebase configuration.
// You can find it in your Firebase project settings for your web app.
// The projectId should be "studio-1417373480-b2959".
const firebaseConfig = {
  apiKey: "AIzaSyCbVLB9dpn4gu8jD1s4PfG8Zz_dVqOopC0",
  authDomain: "studio-1417373480-b2959.firebaseapp.com",
  projectId: "studio-1417373480-b2959",
  storageBucket: "studio-1417373480-b2959.firebasestorage.app",
  messagingSenderId: "646607853116",
  appId: "1:646607853116:web:2b01343ea1eccf43e71539"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

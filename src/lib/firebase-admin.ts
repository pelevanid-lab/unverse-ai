import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey || !clientEmail) {
      console.error("❌ FIREBASE_ADMIN_ERROR: Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL in environment.");
      // We don't throw here to avoid crashing the whole process if only some routes need Admin, 
      // but the routes using it will eventually fail with a clear message.
  }

  try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey?.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
  } catch (initErr: any) {
      console.error("❌ FIREBASE_ADMIN_INIT_FAILED:", initErr.message);
  }
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();

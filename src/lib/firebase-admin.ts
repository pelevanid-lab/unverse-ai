import * as admin from 'firebase-admin';

const initAdmin = () => {
  if (admin.apps.length) return;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey || !clientEmail) {
      if (process.env.NODE_ENV === 'production') {
        console.warn("⚠️ FIREBASE_ADMIN_WARNING: Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL. This is expected during build but will fail at runtime.");
      }
      return;
  }

  try {
      // Handle escaped newlines and literal quotes that sometimes appear in environment variables
      const formattedKey = privateKey
        .replace(/\\n/g, '\n')
        .replace(/^"(.*)"$/, '$1')
        .replace(/^'(.*)'$/, '$1');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log("✅ FIREBASE_ADMIN_INITIALIZED");
  } catch (initErr: any) {
      console.error("❌ FIREBASE_ADMIN_INIT_FAILED:", initErr.message);
  }
};

// Lazy-loading exports via Proxies to prevent build-time crashes in Next.js 15
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get: (target, prop) => {
    initAdmin();
    return (admin.firestore() as any)[prop];
  }
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get: (target, prop) => {
    initAdmin();
    return (admin.storage() as any)[prop];
  }
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get: (target, prop) => {
    initAdmin();
    return (admin.auth() as any)[prop];
  }
});


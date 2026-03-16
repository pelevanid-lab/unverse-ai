
// This script migrates historical data from the 'ledger' collection to the 'users' collection.
// It populates 'unlockedPostIds' and 'activeSubscriptionIds' arrays in each user's document.

// HOW TO RUN:
// 1. Install Firebase Admin SDK: `npm install firebase-admin`
// 2. Authenticate your environment. You must have a Firebase service account key.
//    - Mac/Linux:   `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"`
//    - Windows:     `set GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your\serviceAccountKey.json"`
// 3. Run the script from your project root: `node scripts/migrateLedgerData.js`

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK. It will automatically use the GOOGLE_APPLICATION_CREDENTIALS env var.
admin.initializeApp({
    // If your project ID is not in the key file, specify it here
    // projectId: 'YOUR_PROJECT_ID'
});

const db = admin.firestore();

async function migrateData() {
  console.log('🚀 Starting data migration... This may take a few minutes.');
  const startTime = Date.now();

  try {
    const ledgerSnapshot = await db.collection('ledger').get();
    const userUpdates = new Map();

    console.log(`Found ${ledgerSnapshot.size} total entries in the ledger.`);

    ledgerSnapshot.forEach(doc => {
      const entry = doc.data();
      // Ensure wallet address is consistently lowercase
      const walletAddress = entry.fromWallet?.toLowerCase();

      if (!walletAddress || !entry.referenceId) {
        // Skip entries with missing data
        return;
      }

      // Initialize a structure for the user if it's the first time we see them.
      if (!userUpdates.has(walletAddress)) {
        userUpdates.set(walletAddress, {
          unlockedPostIds: new Set(),
          activeSubscriptionIds: new Set()
        });
      }

      const update = userUpdates.get(walletAddress);

      if (entry.type === 'premium_unlock') {
        update.unlockedPostIds.add(entry.referenceId);
      } else if (entry.type === 'subscription_payment') {
        // Assuming subscription referenceId is the creator's UID
        update.activeSubscriptionIds.add(entry.referenceId);
      }
    });

    console.log(`Aggregated purchase data for ${userUpdates.size} unique users.`);

    const batchPromises = [];
    let updatedCount = 0;

    for (const [walletAddress, updates] of userUpdates.entries()) {
      // Per your database structure, the user document ID is the wallet address.
      const userRef = db.collection('users').doc(walletAddress);
      
      const updatePayload = {};

      if (updates.unlockedPostIds.size > 0) {
        // FieldValue.arrayUnion ensures we don't add duplicate IDs. It's safe to re-run.
        updatePayload.unlockedPostIds = admin.firestore.FieldValue.arrayUnion(...Array.from(updates.unlockedPostIds));
      }
      if (updates.activeSubscriptionIds.size > 0) {
        updatePayload.activeSubscriptionIds = admin.firestore.FieldValue.arrayUnion(...Array.from(updates.activeSubscriptionIds));
      }

      // Only write to the database if there is something to add.
      if (Object.keys(updatePayload).length > 0) {
        // We use `update` here. This will fail if a user exists in the ledger but not in the users collection.
        // This is safer as it prevents creating empty user shells.
        batchPromises.push(userRef.update(updatePayload).catch(err => {
            console.warn(`Could not update user ${walletAddress}. They may not exist in the 'users' collection. Error: ${err.message}`);
        }));
        updatedCount++;
      }
    }

    if(batchPromises.length === 0) {
        console.log("No new data to migrate.");
    } else {
        console.log(`Preparing to update ${updatedCount} user documents...`);
        await Promise.all(batchPromises);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('-----------------------------------------');
    console.log(`✅ Migration completed in ${duration} seconds.`);
    console.log(`✅ ${updatedCount} user documents were successfully updated.`);
    console.log('-----------------------------------------');

  } catch (error) {
    console.error('❌ FATAL MIGRATION ERROR:', error);
    process.exit(1);
  }
}

migrateData();

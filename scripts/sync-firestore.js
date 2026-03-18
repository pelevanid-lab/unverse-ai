
const admin = require('firebase-admin');
const path = require('path');
const serviceAccountPath = path.resolve(__dirname, '../key.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function cleanupAndSyncConfig() {
    console.log('--- Cleaning up and Syncing Firestore Config ---');
    
    const configRef = db.collection('config').doc('system');
    const configSnap = await configRef.get();
    
    if (configSnap.exists) {
        // 1. Remove old fields using FieldValue.delete()
        await configRef.update({
            treasury_network: admin.firestore.FieldValue.delete(),
            treasury_wallet_address: admin.firestore.FieldValue.delete()
        });
        console.log('Removed legacy treasury fields.');

        // 2. Ensure new structure is solid
        const currentData = configSnap.data();
        const treasuryWallets = currentData.treasury_wallets || {};
        
        // Use real values or maintain placeholders if they are already there
        const updateObj = {
            treasury_wallets: {
                TON: treasuryWallets.TON || "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
                TRON: treasuryWallets.TRON || "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2" // Use the old address as the new TRON treasury for now
            },
            platform_subscription_fee_split: currentData.platform_subscription_fee_split || 0.1,
            admin_wallet_address: "0xd50e7b89510123456789abcdef0123456789abcd" // Sync with user's current wallet
        };

        await configRef.set(updateObj, { merge: true });
        console.log('Syncing treasury_wallets and admin_wallet_address.');
    }

    console.log('Firestore cleanup complete.');
}

cleanupAndSyncConfig().catch(console.error);

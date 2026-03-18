
const admin = require('firebase-admin');
const path = require('path');
const serviceAccountPath = path.resolve(__dirname, '../key.json');
// Check if key.json exists before requiring, as it was deleted in some steps
let serviceAccount;
try {
    serviceAccount = require(serviceAccountPath);
} catch (e) {
    console.error("key.json not found. Please ensure it exists for syncing Firestore.");
    process.exit(1);
}

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
    
    const newAdminAddress = "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";

    if (configSnap.exists) {
        // 1. Remove old fields
        await configRef.update({
            treasury_network: admin.firestore.FieldValue.delete(),
            treasury_wallet_address: admin.firestore.FieldValue.delete()
        });
        console.log('Removed legacy treasury fields.');

        // 2. Update to new admin address and ensure structure
        const currentData = configSnap.data();
        const treasuryWallets = currentData.treasury_wallets || {};
        
        const updateObj = {
            admin_wallet_address: newAdminAddress,
            treasury_wallets: {
                TON: treasuryWallets.TON || "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
                TRON: treasuryWallets.TRON || "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2"
            }
        };

        await configRef.set(updateObj, { merge: true });
        console.log(`Syncing admin_wallet_address to: ${newAdminAddress}`);
    } else {
        // Create if doesn't exist
        await configRef.set({
            admin_wallet_address: newAdminAddress,
            platform_subscription_fee_split: 0.1,
            genesis_initialized: false,
            treasury_wallets: {
                TON: "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
                TRON: "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2"
            }
        });
        console.log(`Created system config with admin: ${newAdminAddress}`);
    }

    console.log('Firestore cleanup and sync complete.');
}

cleanupAndSyncConfig().catch(console.error);

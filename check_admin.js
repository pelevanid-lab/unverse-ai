const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function checkAdmin() {
    try {
        const configSnap = await db.collection('config').doc('system').get();
        const configData = configSnap.data();
        console.log('--- SYSTEM CONFIG ---');
        console.log('Admin Wallet:', configData.admin_wallet_address);

        const usersSnap = await db.collection('users').get();
        console.log('\n--- USERS ---');
        usersSnap.forEach(doc => {
            const data = doc.data();
            console.log(`User ${doc.id}: Wallet: ${data.walletAddress}, isAdmin: ${data.isAdmin}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

checkAdmin();

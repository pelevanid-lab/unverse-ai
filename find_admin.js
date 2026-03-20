const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function findAdmin() {
    const adminWallet = "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";
    try {
        const snapshot = await db.collection('users').where('walletAddress', '==', adminWallet).get();
        if (snapshot.empty) {
            console.log('No user found with wallet:', adminWallet);
            // Search case-insensitive
            const allUsers = await db.collection('users').get();
            allUsers.forEach(doc => {
                const w = doc.data().walletAddress;
                if (w && w.toLowerCase() === adminWallet.toLowerCase()) {
                    console.log(`Found Match! DocID: ${doc.id}, Data:`, doc.data());
                }
            });
        } else {
            snapshot.forEach(doc => {
                console.log(`Found Admin User. DocID: ${doc.id}, Data:`, doc.data());
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

findAdmin();

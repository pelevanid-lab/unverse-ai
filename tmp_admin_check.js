const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const WALLET = "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";

async function checkAdmin() {
    console.log(`Checking profile for wallet: ${WALLET}`);
    
    // 1. Direct check by ID
    const docRef = db.collection('users').doc(WALLET);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
        console.log("✅ Document found by Wallet ID.");
        console.log("Data:", JSON.stringify(docSnap.data(), null, 2));
    } else {
        console.log("❌ Document NOT found by Wallet ID.");
        
        // 2. Search by walletAddress field
        const querySnap = await db.collection('users').where('walletAddress', '==', WALLET).get();
        if (!querySnap.empty) {
            console.log("✅ Document found by walletAddress field search.");
            querySnap.forEach(d => console.log(`Doc ID: ${d.id}`, JSON.stringify(d.data(), null, 2)));
        } else {
            console.log("❌ Document NOT found by walletAddress field either.");
        }
    }
}

checkAdmin().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

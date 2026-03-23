const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkAdmin() {
    const wallet = "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";
    console.log("Checking wallet:", wallet);
    
    const usersSnap = await db.collection("users").where("walletAddress", "==", wallet).get();
    if (usersSnap.empty) {
        console.log("No user found with this wallet address.");
    } else {
        usersSnap.forEach(doc => {
            console.log("User UID:", doc.id);
            console.log("User Data:", JSON.stringify(doc.data(), null, 2));
        });
    }

    const configSnap = await db.collection("config").doc("system").get();
    console.log("System Admin Wallet:", configSnap.data()?.admin_wallet_address);
}

checkAdmin();

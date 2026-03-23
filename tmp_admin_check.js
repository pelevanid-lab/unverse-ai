const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function check() {
    const configSnap = await db.collection('config').doc('system').get();
    const adminWallet = configSnap.data().admin_wallet_address;
    console.log("Config admin_wallet_address:", adminWallet);

    const usersSnap = await db.collection('users').where('walletAddress', '==', adminWallet).get();
    usersSnap.forEach(doc => {
        console.log("User doc ID:", doc.id);
        console.log("User authUid:", doc.data().authUid);
        console.log("User isAdmin:", doc.data().isAdmin);
        console.log("User walletAddress:", doc.data().walletAddress);
    });

    const userByLower = await db.collection('users').get();
    let found = false;
    userByLower.forEach(doc => {
        if (doc.data().walletAddress && doc.data().walletAddress.toLowerCase() === adminWallet?.toLowerCase()) {
            console.log("Found by lower case:", doc.id);
            found = true;
        }
    });

}

check().catch(console.error).then(() => process.exit(0));

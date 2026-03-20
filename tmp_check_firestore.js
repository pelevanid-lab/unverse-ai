
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkConfig() {
    console.log('--- FIRESTORE CONFIG VERIFICATION ---');
    
    const systemSnap = await db.collection('config').doc('system').get();
    console.log('\n[config/system]:');
    console.log(JSON.stringify(systemSnap.data(), null, 2));

    const statsSnap = await db.collection('config').doc('stats').get();
    console.log('\n[config/stats]:');
    console.log(JSON.stringify(statsSnap.data(), null, 2));
    
    process.exit(0);
}

checkConfig().catch(err => {
    console.error(err);
    process.exit(1);
});

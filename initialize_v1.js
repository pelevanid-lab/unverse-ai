const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initialize() {
    console.log('--- FIRESTORE INITIALIZATION ---');
    
    try {
        const configRef = db.collection('config').doc('system');
        
        // 1. Initialize Pools and USDT Stats
        await configRef.set({
            pools: {
                reserve: 420000000,
                team: 130000000,
                creators: 120000000,
                presale: 100000000,
                liquidity: 60000000,
                promo: 50000000,
                exchanges: 40000000
            },
            totalTreasuryUSDT: 0,
            totalBuybackUSDT: 0,
            genesis_initialized: true
        }, { merge: true });
        console.log('✅ System Pools & USDT Stats initialized.');

        // 2. Initialize User USDT Balances
        const usersSnap = await db.collection('users').get();
        const batch = db.batch();
        usersSnap.forEach(doc => {
            batch.update(doc.ref, {
                usdtBalance: { available: 0, claimable: 0 }
            });
        });
        await batch.commit();
        console.log(`✅ ${usersSnap.size} users updated with usdtBalance.`);

    } catch (e) {
        console.error('❌ Initialization failed:', e.stack);
    }
    process.exit(0);
}

initialize();

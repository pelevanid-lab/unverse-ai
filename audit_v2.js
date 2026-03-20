const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function runAudit() {
    console.log('--- FIRESTORE CONSISTENCY AUDIT ---');
    
    try {
        const configRef = db.collection('config').doc('system');
        const configSnap = await configRef.get();
        if (!configSnap.exists) {
            console.error('❌ FATAL: config/system does not exist!');
        } else {
            const config = configSnap.data();
            console.log('✅ System Config Found.');
            
            const requiredPools = ['reserve', 'team', 'creators', 'presale', 'liquidity', 'exchanges', 'promo'];
            const pools = config.pools || {};
            const missingPools = requiredPools.filter(p => pools[p] === undefined);
            
            if (missingPools.length > 0) {
                console.error(`❌ Missing Pools in config: ${missingPools.join(', ')}`);
            } else {
                console.log('✅ All pools initialized in config.');
            }

            console.log(`- Treasury USDT: ${config.totalTreasuryUSDT || 0}`);
            console.log(`- Buyback USDT: ${config.totalBuybackUSDT || 0}`);
            console.log(`- Admin Wallet: ${config.admin_wallet_address || 'NOT_SET'}`);
        }

        console.log('\n--- User Schema ---');
        const usersSnap = await db.collection('users').limit(5).get();
        usersSnap.forEach(doc => {
            const data = doc.data();
            console.log(`User ${doc.id}: ULC? ${!!data.ulcBalance}, USDT? ${!!data.usdtBalance}`);
        });

    } catch (e) {
        console.error('❌ Audit failed:', e.message);
    }
    process.exit(0);
}

runAudit();

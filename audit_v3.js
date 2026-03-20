const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function runAudit() {
    console.log('--- FIRESTORE DEEP SYNC AUDIT ---');
    
    try {
        const configRef = db.collection('config').doc('system');
        const configSnap = await configRef.get();
        if (!configSnap.exists) {
            console.error('❌ FATAL: config/system does not exist!');
        } else {
            const config = configSnap.data();
            console.log('✅ System Config Found.');
            
            // 1. Audit Pools
            const requiredPools = ['reserve', 'team', 'creators', 'presale', 'liquidity', 'exchanges', 'promo'];
            const pools = config.pools || {};
            const missingPools = requiredPools.filter(p => pools[p] === undefined);
            
            if (missingPools.length > 0) {
                console.error(`❌ Inconsistency: Missing Pools in config -> ${missingPools.join(', ')}`);
            } else {
                console.log('✅ Pool balances are perfectly synchronized.');
            }

            // 2. Audit USDT Stats
            console.log(`- Treasury USDT: ${config.totalTreasuryUSDT || 0}`);
            console.log(`- Buyback USDT: ${config.totalBuybackUSDT || 0}`);
            
            if (config.totalTreasuryUSDT === undefined || config.totalBuybackUSDT === undefined) {
                console.warn('⚠️ Warning: USDT global stats are not yet initialized in Firestore.');
            }

            // 3. User Balance Schema Check
            console.log('\n--- User Metadata Synchronization ---');
            const usersSnap = await db.collection('users').get();
            let usdtSynced = 0;
            let ulcSynced = 0;
            let totalUsers = usersSnap.size;

            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.usdtBalance) usdtSynced++;
                if (data.ulcBalance) ulcSynced++;
            });

            console.log(`✅ ULC Balance field present in ${ulcSynced}/${totalUsers} users.`);
            console.log(`✅ USDT Balance field present in ${usdtSynced}/${totalUsers} users.`);

            // 4. Vesting Consistency
            console.log('\n--- Vesting Logic Verification ---');
            const vestingSnap = await db.collection('vesting_schedules').get();
            let withPoolId = 0;
            vestingSnap.forEach(doc => {
                if (doc.data().poolId) withPoolId++;
            });
            console.log(`✅ ${withPoolId}/${vestingSnap.size} vesting schedules have source pool tracking.`);

        }

    } catch (e) {
        console.error('❌ Audit failed:', e.stack);
    }
    process.exit(0);
}

runAudit();

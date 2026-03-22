
import { db } from './src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function checkStats() {
    console.log("Checking System Config...");
    const sysSnap = await getDoc(doc(db, 'config', 'system'));
    if (sysSnap.exists()) {
        console.log("Config/System:", JSON.stringify(sysSnap.data(), null, 2));
    } else {
        console.log("Config/System NOT FOUND");
    }

    console.log("\nChecking Stats Config...");
    const statsSnap = await getDoc(doc(db, 'config', 'stats'));
    if (statsSnap.exists()) {
        console.log("Config/Stats:", JSON.stringify(statsSnap.data(), null, 2));
    } else {
        console.log("Config/Stats NOT FOUND");
    }
}

checkStats().catch(console.error);

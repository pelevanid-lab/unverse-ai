
import { db } from './src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function checkUser() {
    console.log("Searching for creator 'a super'...");
    const q = query(collection(db, 'users'), where('username', '==', 'a super'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("No user found with username 'a super'.");
        return;
    }

    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log("User ID:", doc.id);
        console.log("Avatar Field:", data.avatar);
        console.log("PromoCard Avatar:", data.promoCard?.creatorAvatar);
        console.log("PromoCard Image:", data.promoCard?.imageUrl);
    });
}

checkUser().catch(console.error);

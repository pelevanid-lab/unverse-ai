/**
 * tmp_check_posts.js
 * Firestore'daki posts koleksiyonunu tarar, bozuk mediaUrl olan postları listeler.
 * Kullanım: node tmp_check_posts.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Service account key'i functions/ klasöründen al
let serviceAccount;
try {
  serviceAccount = require('./functions/service-account.json');
} catch (e) {
  // Alternatif konumlar dene
  try {
    serviceAccount = require('./service-account.json');
  } catch (e2) {
    console.error('❌ service-account.json bulunamadı. GOOGLE_APPLICATION_CREDENTIALS env değişkenine güveniliyor...');
    serviceAccount = null;
  }
}

if (!admin.apps.length) {
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'studio-1417373480-b2959.firebasestorage.app'
    });
  } else {
    admin.initializeApp({
      projectId: 'studio-1417373480-b2959',
      storageBucket: 'studio-1417373480-b2959.firebasestorage.app'
    });
  }
}

const db = admin.firestore();

async function checkPosts() {
  console.log('🔍 Firestore posts koleksiyonu taranıyor...\n');
  
  const postsSnap = await db.collection('posts').orderBy('createdAt', 'desc').limit(200).get();
  
  const total = postsSnap.size;
  const broken = [];
  const gsUrls = [];
  const emptyMedia = [];
  const placeholderCaptions = [];

  for (const doc of postsSnap.docs) {
    const data = doc.data();
    const mediaUrl = data.mediaUrl || '';
    const content = data.content || data.title || '';
    
    // gs:// formatında URL
    if (mediaUrl.startsWith('gs://')) {
      gsUrls.push({ id: doc.id, creatorId: data.creatorId, creatorName: data.creatorName, mediaUrl, contentType: data.contentType });
    }
    
    // Boş mediaUrl
    if (!mediaUrl) {
      emptyMedia.push({ id: doc.id, creatorId: data.creatorId, creatorName: data.creatorName, contentType: data.contentType });
    }
    
    // Placeholder caption
    if (!content || content === 'post' || /^[\p{Emoji}\s]*post$/u.test(content.trim())) {
      placeholderCaptions.push({ id: doc.id, creatorId: data.creatorId, creatorName: data.creatorName, content, contentType: data.contentType, mediaUrl: mediaUrl.substring(0, 80) + '...' });
    }
  }

  console.log(`📊 Toplam post: ${total}`);
  console.log('─'.repeat(60));
  
  if (gsUrls.length > 0) {
    console.log(`\n⚠️  gs:// URL formatı (${gsUrls.length} post) — tarayıcı açamaz:`);
    gsUrls.forEach(p => {
      console.log(`  • [${p.id}] ${p.creatorName} (${p.contentType}) — ${p.mediaUrl.substring(0, 60)}...`);
    });
  } else {
    console.log('\n✅ gs:// URL sorunu yok');
  }
  
  if (emptyMedia.length > 0) {
    console.log(`\n❌ Boş mediaUrl (${emptyMedia.length} post) — medya hiç yüklenmez:`);
    emptyMedia.forEach(p => {
      console.log(`  • [${p.id}] ${p.creatorName} (${p.contentType})`);
    });
  } else {
    console.log('✅ Boş mediaUrl sorunu yok');
  }
  
  if (placeholderCaptions.length > 0) {
    console.log(`\n🖼️  Placeholder caption (${placeholderCaptions.length} post):`);
    placeholderCaptions.forEach(p => {
      console.log(`  • [${p.id}] ${p.creatorName} — content: "${p.content}" | mediaUrl: ${p.mediaUrl}`);
    });
  } else {
    console.log('✅ Placeholder caption sorunu yok');
  }

  // Storage'da dosya var mı kontrol et (ilk bozuk post için)
  if (gsUrls.length > 0 || emptyMedia.length > 0) {
    console.log('\n📁 Firebase Storage\'da dosya varlığı kontrol ediliyor...');
    const postsToCheck = [...gsUrls, ...emptyMedia].slice(0, 5);
    const bucket = admin.storage().bucket();
    
    for (const p of postsToCheck) {
      if (!p.mediaUrl) { console.log(`  • [${p.id}] mediaUrl boş — Storage'da kontrol edilemez`); continue; }
      
      let storagePath = p.mediaUrl;
      if (storagePath.startsWith('gs://')) {
        storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
      } else if (storagePath.startsWith('http')) {
        try {
          const decoded = decodeURIComponent(storagePath);
          if (decoded.includes('/o/')) storagePath = decoded.split('/o/')[1].split('?')[0];
        } catch {}
      }
      
      try {
        const [exists] = await bucket.file(storagePath).exists();
        console.log(`  • [${p.id}] ${p.creatorName}: Storage dosyası ${exists ? '✅ mevcut' : '❌ SİLİNMİŞ'} — ${storagePath}`);
      } catch (err) {
        console.log(`  • [${p.id}] ${p.creatorName}: Storage kontrol hatası — ${err.message}`);
      }
    }
  }

  console.log('\n✅ Tarama tamamlandı.');
  process.exit(0);
}

checkPosts().catch(err => {
  console.error('❌ Hata:', err.message);
  process.exit(1);
});

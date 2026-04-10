/**
 * tmp_check_media.mjs
 * Firestore creator_media collection'ından belirli dökümanların status alanını kontrol eder.
 * 
 * Kullanım: node tmp_check_media.mjs
 * Not: Firebase REST API kullanır, service account gerekmez.
 */

const PROJECT_ID = 'studio-1417373480-b2959';
const CREATOR_ID = '0x3b5037baca1bae82b7f522c816176d46b98e53a3';

// Kullanıcının paylaştığı 39 döküman ID'si
const DOC_IDS = [
  '18WriecqPpbx34CHK5kV', '3dDj4kyHJ4yGYZPmAdm6', '4ojpUloVL8fFB0mr4JNf',
  '7UIo3CotZEN3qN9DHjvz', '8ATKxo3a85iSdpLbQWKu', 'BqKLPmmqJt53LwizuOhd',
  'CYwLgJPKxHT7Qm1zvkvz', 'DFsrHi89R8OpvIuscj5d', 'DPSSdYZPjMC1IZPyh04R',
  'DwtEtXeAgHLw1H53K9GB', 'KrT6604mKDnOklQ2Qs0t', 'M7LcgNgRAWSAZ9C5jDgy',
  'MJPAOFlftUQaQ2EUma61', 'SGMY5Of6SepCmuAvxCzP', 'TNk0JGm8U6tu5mI0Gvkp',
  'UKRej5hi7pSpyi8tuIIb', 'UxJqZvuZ8Vwl4kSBQIid', 'YAnM91lNBYujZQCVPS9P',
  'Z6AkuINFjVJRJAlS71Vf', 'ZOfeDBGJ92DMIFKvvVcq', 'bMQzGbouEbTsMg4vP4ur',
  'blAQrcY6Asu7piHVtLXT', 'bvx51L29KmEHS7UcTJdw', 'dXUFD1wX58VWV0G5km2y',
  'daY5wwZYHFKr9U6DhJNV', 'dpryA3GKkjHa3zd4BYv1', 'ioe557J9jeSAUjXQQgKr',
  'kY150AjgVwtpVvtao4pn', 'lDHb3hzoqfNEJDLalkpv', 'nsZ8mbNmFJqiOBsSdMNP',
  'o5tWbld8DLxkptSGhTmF', 'oczvdqD4uEZWwL3lKB6V', 'pOQKO65qQkNjvhB5dzuy',
  'pb6niM8iTlqKJOo7GIk4', 'qdZotEmEfF4ZOvSfi90f', 'sLgZsMPh3DRb8y3ZqYYi',
  'wJISJHeW5wwfySGTHcMq', 'xFfz3iocZfamHdHonANE', 'ytOrSweDefshi0kjeYSl'
];

// Firestore REST API base URL
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getDoc(collection, docId) {
  const url = `${BASE_URL}/${collection}/${docId}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 403) return { error: 'PERMISSION_DENIED', docId };
    if (res.status === 404) return { error: 'NOT_FOUND', docId };
    return { error: `HTTP_${res.status}`, docId };
  }
  return await res.json();
}

function extractField(doc, fieldName) {
  const fields = doc.fields || {};
  const field = fields[fieldName];
  if (!field) return undefined;
  return field.stringValue ?? field.integerValue ?? field.booleanValue ?? field.nullValue ?? null;
}

async function main() {
  console.log(`🔍 ${DOC_IDS.length} dökümanın status'u kontrol ediliyor...\n`);

  const stats = {};
  const errors = [];
  const results = [];

  for (const docId of DOC_IDS) {
    const doc = await getDoc('creator_media', docId);
    
    if (doc.error) {
      errors.push({ docId, error: doc.error });
      continue;
    }

    const status = extractField(doc, 'status') ?? 'MISSING';
    const mediaType = extractField(doc, 'mediaType') ?? '?';
    const creatorId = extractField(doc, 'creatorId') ?? '?';
    const caption = extractField(doc, 'caption') ?? '';
    
    stats[status] = (stats[status] || 0) + 1;
    results.push({ docId, status, mediaType, creatorId: creatorId.substring(0, 10) + '...', caption: caption.substring(0, 30) });
  }

  console.log('📊 Status Dağılımı:');
  console.log('─'.repeat(40));
  for (const [status, count] of Object.entries(stats)) {
    const emoji = status === 'draft' ? '📝' : status === 'published' ? '🌐' : status === 'MISSING' ? '❌' : '❓';
    console.log(`  ${emoji} ${status}: ${count} döküman`);
  }

  if (errors.length > 0) {
    console.log(`\n⚠️  Hata veren dökümanlar (${errors.length}):`);
    errors.forEach(e => console.log(`  • [${e.docId}] ${e.error}`));
  }

  console.log('\n📋 Detaylı Sonuçlar:');
  console.log('─'.repeat(80));
  results.forEach(r => {
    const show = r.status !== 'draft'; // Non-draft olanları vurgula
    const prefix = show ? '⚠️ ' : '  ';
    console.log(`${prefix}[${r.docId}] status="${r.status}" type=${r.mediaType}`);
  });

  console.log(`\n📌 Özet:`);
  console.log(`  ContainerTab yalnızca ['draft', 'scheduled', 'planned'] status'ları gösteriyor.`);
  const notShown = results.filter(r => !['draft', 'scheduled', 'planned'].includes(r.status)).length;
  console.log(`  Bu filtreye TAKILABİLECEK fotoğraf sayısı: ${notShown}`);
  console.log(`  (Eğer çoğu 'published' veya boş ise, bu medya stokta görünmeyecek)`);
}

main().catch(console.error);

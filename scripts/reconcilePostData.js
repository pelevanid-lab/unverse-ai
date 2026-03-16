
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  if (e.code !== 'app/duplicate-app') {
    console.error('Firebase initialization error:', e);
    process.exit(1);
  }
}

const db = admin.firestore();

async function reconcilePostData() {
  console.log('🚀 Starting comprehensive post data reconciliation (v3)...');
  const startTime = Date.now();

  try {
    // Task A: Aggregate unlock counts from the ledger
    const ledgerSnapshot = await db.collection('ledger').where('type', '==', 'premium_unlock').get();
    const unlockCounts = new Map();
    ledgerSnapshot.forEach(doc => {
      const entry = doc.data();
      const postId = entry.referenceId;
      if (postId) {
        unlockCounts.set(postId, (unlockCounts.get(postId) || 0) + 1);
      }
    });
    console.log(`[Task A] Found unlock data for ${unlockCounts.size} unique posts.`);

    // Task B: Fetch all public creator profiles
    const creatorsSnapshot = await db.collection('creators').get();
    const creatorProfiles = new Map();
    creatorsSnapshot.forEach(doc => {
      const creator = doc.data();
      if (creator.uid) {
          creatorProfiles.set(creator.uid, {
              name: creator.displayName || `Creator_${creator.uid.slice(0, 6)}`,
              avatar: creator.avatar || ''
          });
      }
    });
    console.log(`[Task B] Fetched ${creatorProfiles.size} public creator profiles.`);

    // Task C: Reconcile each post in the `posts` collection
    // *** THE FIX IS HERE: Using the correct collection name: `posts` ***
    const postsSnapshot = await db.collection('posts').get();
    let updatedCount = 0;

    console.log(`[Task C] Found ${postsSnapshot.size} total posts to check for reconciliation.`);

    if (postsSnapshot.empty) {
        console.log('[Task C] No posts found. Nothing to reconcile.');
    } else {
        const batchPromises = [];
        for (const doc of postsSnapshot.docs) {
            const postId = doc.id;
            const postData = doc.data();
            const postRef = db.collection('posts').doc(postId);

            const correctUnlockCount = unlockCounts.get(postId) || 0;
            const publicCreator = creatorProfiles.get(postData.creatorId);

            const updatePayload = {};
            let needsUpdate = false;

            if ((postData.unlockCount || 0) !== correctUnlockCount) {
                updatePayload.unlockCount = correctUnlockCount;
                needsUpdate = true;
                console.log(`  - Reconciling unlock count for post ${postId}: ${postData.unlockCount || 0} -> ${correctUnlockCount}`);
            }

            if (publicCreator) {
                if (postData.creatorName !== publicCreator.name) {
                    updatePayload.creatorName = publicCreator.name;
                    needsUpdate = true;
                    console.log(`  - Reconciling creatorName for post ${postId}: "${postData.creatorName}" -> "${publicCreator.name}"`);
                }
                if (postData.creatorAvatar !== publicCreator.avatar) {
                    updatePayload.creatorAvatar = publicCreator.avatar;
                    needsUpdate = true;
                    console.log(`  - Reconciling creatorAvatar for post ${postId}`);
                }
            }

            if (needsUpdate) {
                const batch = db.batch();
                batch.update(postRef, updatePayload);
                batchPromises.push(batch.commit());
                updatedCount++;
            }
        }
        if (batchPromises.length > 0) {
            await Promise.all(batchPromises);
        }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('-----------------------------------------');
    console.log(`✅ Reconciliation completed in ${duration} seconds.`);
    if (updatedCount > 0) {
      console.log(`✅ ${updatedCount} post document(s) were successfully updated.`);
    } else {
      console.log('✅ All post data was already up-to-date.');
    }
    console.log('-----------------------------------------');

  } catch (error) {
    console.error('❌ FATAL RECONCILIATION ERROR:', error);
    process.exit(1);
  }
}

reconcilePostData();

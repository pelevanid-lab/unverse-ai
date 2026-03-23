
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const now = Date.now();

    // 1. Query for all scheduled media in the container
    const q = query(
      collection(db, 'creator_media'), 
      where('status', '==', 'scheduled')
      // Removed scheduledFor filter here to avoid composite index requirement
    );
    
    const allScheduledSnap = await getDocs(q);

    // Filter by time in memory
    const scheduledDocs = allScheduledSnap.docs.filter(doc => {
        const data = doc.data();
        return data.scheduledFor && data.scheduledFor <= now;
    });

    if (scheduledDocs.length === 0) {
      return NextResponse.json({ message: 'No scheduled media ready for publishing.' });
    }

    let publishedCount = 0;

    // 2. Process each filtered item
    for (const mediaDoc of scheduledDocs) {
        const mediaData = mediaDoc.data();
        
        // Fetch creator profile for post metadata
        const userSnap = await getDoc(doc(db, 'users', mediaData.creatorId));
        if (!userSnap.exists()) {
            console.error(`Creator ${mediaData.creatorId} not found for media ${mediaDoc.id}`);
            continue;
        }
        const creator = userSnap.data();

        const postData = {
            creatorId: mediaData.creatorId,
            creatorName: creator.username,
            creatorAvatar: creator.avatar,
            mediaUrl: mediaData.mediaUrl,
            mediaType: mediaData.mediaType,
            content: mediaData.caption || '',
            contentType: mediaData.contentType || 'public',
            unlockPrice: mediaData.priceULC || 0,
            createdAt: now,
            likes: 0,
            unlockCount: 0,
            earningsULC: 0,
            ...(mediaData.isAI && {
                isAI: true,
                aiPrompt: mediaData.aiPrompt || mediaData.prompt,
                aiEnhancedPrompt: mediaData.aiEnhancedPrompt || mediaData.enhancedPrompt
            }),
            ...(mediaData.contentType === 'limited' && {
                limited: {
                    totalSupply: mediaData.limited?.totalSupply || 100,
                    soldCount: 0,
                    price: mediaData.limited?.price || mediaData.priceULC || 0
                }
            })
        };

        // Create the post
        await addDoc(collection(db, 'posts'), postData);
        // Delete from container
        await deleteDoc(mediaDoc.ref);
        publishedCount++;
    }

    return NextResponse.json({ message: `Successfully published ${publishedCount} posts.` });

  } catch (error: any) {
    console.error('Cron job failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

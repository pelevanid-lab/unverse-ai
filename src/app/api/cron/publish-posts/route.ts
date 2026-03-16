
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const now = new Date();

    // Query for posts that are scheduled and have not been published yet.
    const q = query(
      collection(db, 'posts'), 
      where('isPublished', '==', false), 
      where('scheduledFor', '!=', null),
    );
    
    const scheduledPostsSnap = await getDocs(q);

    if (scheduledPostsSnap.empty) {
      return NextResponse.json({ message: 'No scheduled posts are pending.' });
    }

    // Filter for posts scheduled for now or any time in the past.
    const postsToPublish = scheduledPostsSnap.docs.filter(doc => {
        const postData = doc.data();
        const scheduledFor = postData.scheduledFor.toDate();
        return scheduledFor <= now;
    });

    if(postsToPublish.length === 0){
        return NextResponse.json({ message: 'No posts to publish at this time.' });
    }

    // Use a batch to update all posts in one go.
    const batch = postsToPublish.map(doc => {
        return updateDoc(doc.ref, { 
            isPublished: true, 
            createdAt: Timestamp.now() // Set createdAt to the current time when publishing
        });
    });
    
    await Promise.all(batch);

    return NextResponse.json({ message: `Successfully published ${batch.length} posts.` });

  } catch (error: any) {
    console.error('Cron job failed:', error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

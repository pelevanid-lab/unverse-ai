
"use client"

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost } from '@/lib/types';
import { PostGrid } from '@/components/profile/PostGrid';
import { useWallet } from '@/hooks/use-wallet';

export default function DiscoverPage() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  // The useWallet hook now provides the complete user profile, including unlocked posts
  const { user } = useWallet();

  // This function is passed down to the PostGrid so the UI can update instantly when a new post is unlocked,
  // without needing a full refresh.
  const [locallyUnlockedPostIds, setLocallyUnlockedPostIds] = useState<string[]>([]);
  const handlePostUnlocked = (postId: string) => {
    setLocallyUnlockedPostIds(prev => [...new Set([...prev, postId])]);
  };

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        // Step 1: Fetch posts directly from the `posts` collection.
        // The `unlockCount` and `creatorName` are now correct thanks to the reconciliation script.
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const querySnapshot = await getDocs(postsQuery);
        
        // The data from Firestore is now the source of truth. No more manual calculations.
        const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ContentPost);

        setPosts(postsData);

      } catch (error) {
        console.error("Error fetching posts: ", error);
      }
      setLoading(false);
    };

    fetchPosts();
  }, []);

  // Combine the user's unlocked posts from the database with any newly unlocked ones in this session.
  const allUnlockedPostIds = [ ...new Set([...(user?.unlockedPostIds || []), ...locallyUnlockedPostIds]) ];
  // Subscriptions are also on the user object now (though not used on this page, the logic is ready).
  const subscribedToCreatorIds = user?.activeSubscriptionIds || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold font-headline tracking-tight">Discover</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Explore posts from creators across the Unlonely universe.</p>
      </header>
      
      {loading ? (
        <div className="text-center">
          <p>Loading posts...</p>
        </div>
      ) : (
        <PostGrid 
          postsToShow={posts}
          unlockedPostIds={allUnlockedPostIds} // Use the unified list
          subscribedToCreatorIds={subscribedToCreatorIds}
          onPostUnlocked={handlePostUnlocked}
        />
      )}
    </div>
  );
}

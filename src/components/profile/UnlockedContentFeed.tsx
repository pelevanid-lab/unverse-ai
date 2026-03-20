
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ContentPost, LedgerEntry } from '@/lib/types';
import { PostGrid } from './PostGrid';

export function UnlockedContentFeed() {
  const { user } = useWallet();
  const [unlockedPosts, setUnlockedPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchUnlockedPosts = async () => {
      setLoading(true);
      const q = query(
        collection(db, 'ledger'),
        where('fromWallet', '==', user.walletAddress),
        where('type', '==', 'premium_unlock')
      );

      const querySnapshot = await getDocs(q);
      const postIds = querySnapshot.docs.map(d => (d.data() as LedgerEntry).referenceId);
      const uniquePostIds = [...new Set(postIds)];

      const posts: ContentPost[] = [];
      for (const id of uniquePostIds) {
        if (id) {
          const postRef = doc(db, 'posts', id);
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
            posts.push({ id: postSnap.id, ...postSnap.data() } as ContentPost);
          }
        }
      }

      setUnlockedPosts(posts);
      setLoading(false);
    };

    fetchUnlockedPosts();
  }, [user]);

  if (loading) {
    return <div>Loading unlocked content...</div>;
  }

  return <PostGrid postsToShow={unlockedPosts} unlockedPostIds={unlockedPosts.map(p => p.id)} onPostUnlocked={() => {}} />;
}

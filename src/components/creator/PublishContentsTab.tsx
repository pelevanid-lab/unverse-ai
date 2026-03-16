
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ContentPost, LedgerEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';
import { ViewPostModal } from './ViewPostModal';

export function PublishContentsTab() {
  const { user } = useWallet();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  useEffect(() => {
    if (!user?.walletAddress) return;

    setLoading(true);
    const q = query(collection(db, 'posts'), where('creatorId', '==', user.walletAddress));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost));
      
      const premiumPostIds = fetchedPosts
        .filter(p => p.isPremium)
        .map(p => p.id);

      let postsWithStats = fetchedPosts;

      if (premiumPostIds.length > 0) {
        const ledgerQuery = query(
          collection(db, 'ledger'),
          where('type', '==', 'premium_unlock'),
          where('referenceId', 'in', premiumPostIds)
        );
        
        const ledgerSnapshot = await getDocs(ledgerQuery);
        const unlocks = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);

        postsWithStats = fetchedPosts.map(post => {
          if (post.isPremium) {
            const postUnlocks = unlocks.filter(u => u.referenceId === post.id);
            return {
              ...post,
              unlockCount: postUnlocks.length,
              revenue: postUnlocks.reduce((sum, u) => sum + u.amount, 0),
            };
          }
          return post;
        });
      }
      
      const sortedPosts = postsWithStats.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setPosts(sortedPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.walletAddress]);

  return (
    <>
      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle>Published Content</CardTitle>
          <p className="text-muted-foreground text-sm">Your published posts.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>You haven't published any content yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {posts.map(post => {
                const mediaUrl = post.mediaUrl;
                const isImage = mediaUrl?.includes('.webp') || mediaUrl?.includes('.png') || mediaUrl?.includes('.jpg') || mediaUrl?.includes('.jpeg') || mediaUrl?.includes('image');

                return (
                  <div 
                    key={post.id} 
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50"
                    onClick={() => setSelectedPost(post)}
                  >
                    {mediaUrl && (
                      isImage ? (
                        <img src={mediaUrl} alt={post.caption || 'post'} className="w-full h-full object-cover" />
                      ) : (
                        <video src={mediaUrl} muted loop playsInline className="w-full h-full object-cover" />
                      )
                    )}
                 
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                        {post.isPremium && (
                            <div className="flex items-center gap-3 text-xs font-semibold">
                              <div className="flex items-center gap-1">
                                  <Lock size={14} />
                                  <span>{post.unlockCount || 0}</span>
                              </div>
                            </div>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPost && (
        <ViewPostModal 
          post={selectedPost} 
          onClose={() => setSelectedPost(null)}
        />
      )}
    </>
  );
}

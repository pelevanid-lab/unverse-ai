
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ContentPost } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Heart, Lock, Coins } from 'lucide-react';
import { ViewPostModal } from './ViewPostModal'; // Import the new modal component

export function PublishContentsTab() {
  const { user } = useWallet();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  useEffect(() => {
    if (!user?.walletAddress) return;

    setLoading(true);
    const q = query(collection(db, 'posts'), where('creatorId', '==', user.walletAddress));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost));
      setPosts(fetchedPosts.sort((a, b) => b.createdAt - a.createdAt)); // Sort by newest
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
              <p>You haven\'t published any content yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {posts.map(post => {
                const isImage = post.mediaUrl.includes('.webp') || post.mediaUrl.includes('.png') || post.mediaUrl.includes('.jpg') || post.mediaUrl.includes('.jpeg') || post.mediaUrl.includes('image');
                return (
                  <div 
                    key={post.id} 
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50"
                    onClick={() => setSelectedPost(post)} // Set the selected post on click
                  >
                    {isImage ? (
                         <img src={post.mediaUrl} alt={post.caption || 'post'} className="w-full h-full object-cover" />
                    ):(
                        <video src={post.mediaUrl} muted loop playsInline className="w-full h-full object-cover" />
                    )}
                 
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                     <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                        <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                                <Heart size={14} />
                                <span>{post.likes || 0}</span>
                            </div>
                            
                            {post.isPremium && (
                                <div className="flex items-center gap-1">
                                    <Lock size={14} />
                                    <span>{post.unlockCount || 0}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-1">
                                <Coins size={14} />
                                <span>{(post.earningsULC || 0).toFixed(2)}</span>
                            </div>
                        </div>
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

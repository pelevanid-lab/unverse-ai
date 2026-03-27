
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ContentPost, LedgerEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, Clock, TrendingUp, Coins, Zap } from 'lucide-react';
import { ViewPostModal } from './ViewPostModal';
import { useTranslations } from 'next-intl';
import { VideoPreview } from '../ui/VideoPreview';
import { Badge } from '@/components/ui/badge';

export function PublishContentsTab() {
  const t = useTranslations('Published');
  const { user } = useWallet();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  // Growth Stats Calculation (Mocked for engagement/motivation)
  const totalRevenue = (posts as any[]).reduce((sum, p) => sum + (p.revenue || 0), 0);
  const totalUnlocks = (posts as any[]).reduce((sum, p) => sum + (p.unlockCount || 0), 0);
  const growthVelocity = totalUnlocks > 0 ? Math.min(99, (totalUnlocks * 12.5)) : 0;

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    // Use uid instead of walletAddress for creatorId
    const q = query(collection(db, 'posts'), where('creatorId', '==', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Filter out invalid documents without contentType in memory to stay simple and safe
      const fetchedPosts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ContentPost))
        .filter(p => !!p.contentType);
      
      const premiumAndLimitedPostIds = fetchedPosts
        .filter(p => p.contentType === 'premium' || p.contentType === 'limited')
        .map(p => p.id);

      let postsWithStats = fetchedPosts;

      if (premiumAndLimitedPostIds.length > 0) {
        // Stats for premium unlocks - Added creatorId filter to satisfy security rules
        const ledgerQuery = query(
          collection(db, 'ledger'),
          where('type', '==', 'premium_unlock'),
          where('creatorId', '==', user.uid),
          where('referenceId', 'in', premiumAndLimitedPostIds)
        );
        
        const ledgerSnapshot = await getDocs(ledgerQuery);
        const unlocks = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);

        postsWithStats = fetchedPosts.map(post => {
          if (post.contentType === 'premium' || post.contentType === 'limited') {
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
      
      const sortedPosts = postsWithStats.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setPosts(sortedPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-primary/5 border border-primary/20 p-4 rounded-[2rem] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
             <TrendingUp className="w-16 h-16 text-primary" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
             <TrendingUp className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Growth Potential</p>
            <h3 className="text-xl font-bold font-headline">+{growthVelocity.toFixed(1)}% Velocity</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Scale phase: Unlock more style presets to increase engagement.</p>
          </div>
        </div>
        
        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-[2rem] flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
             <Zap className="w-16 h-16 text-amber-500" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/20">
             <Zap className="text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Monetization Score</p>
            <h3 className="text-xl font-bold font-headline">{totalRevenue.toFixed(2)} USDC Earned</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Success! Your content is generating consistent protocol yield.</p>
          </div>
        </div>
      </div>

      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
             <span>{t('title')}</span>
             <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary uppercase">{posts.length} Items</Badge>
          </CardTitle>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('emptyState')}</p>
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
                        <img src={mediaUrl} alt={post.content || 'post'} className="w-full h-full object-cover" />
                      ) : (
                        <VideoPreview 
                          src={mediaUrl} 
                        />
                      )
                    )}
                 
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                        <div className="flex items-center gap-2">
                            {post.contentType === 'premium' && <Lock size={14} className="text-primary" />}
                            {post.contentType === 'limited' && <Clock size={14} className="text-yellow-400" />}
                            {(post.contentType !== 'public') && (
                                <span className="text-[10px] font-bold">{post.unlockCount || 0} {t('unlocks')}</span>
                            )}
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

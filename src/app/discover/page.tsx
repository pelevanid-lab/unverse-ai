
"use client"

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost, UserProfile, PromoCard } from '@/lib/types';
import { PostGrid } from '@/components/profile/PostGrid';
import { useWallet } from '@/hooks/use-wallet';
import { Loader2, Zap, Search, TrendingUp, Sparkles, Megaphone, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function PromoCarousel({ promos }: { promos: PromoCard[] }) {
    if (promos.length === 0) return null;
    
    return (
        <div className="w-full overflow-x-auto custom-scrollbar flex gap-6 pb-6 px-1 snap-x">
            {promos.map((p, i) => (
                <Link href={`/profile/${p.creatorId}`} key={i} className="flex-shrink-0 w-[280px] sm:w-[340px] snap-start">
                    <div className="aspect-[16/10] relative rounded-[2rem] overflow-hidden border border-white/10 shadow-xl group hover:border-primary/50 transition-all bg-muted/20">
                        <img src={p.imageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={p.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                            <Avatar className="w-8 h-8 border border-white/20 shadow-md">
                                <AvatarImage src={p.creatorAvatar} />
                                <AvatarFallback>{p.creatorName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md">{p.creatorName}</span>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
                            <h3 className="text-xl font-headline font-bold text-white leading-tight">{p.title}</h3>
                            <p className="text-xs text-white/70 line-clamp-1">{p.description}</p>
                            <Button className="w-full h-10 rounded-xl font-bold bg-white text-black hover:bg-primary hover:text-white transition-all shadow-lg text-xs gap-2">
                                {p.ctaText || "View Profile"} <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export default function DiscoverPage() {
  const [contentChunks, setContentChunks] = useState<{ type: 'posts' | 'promo', data: any }[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useWallet();

  const [locallyUnlockedPostIds, setLocallyUnlockedPostIds] = useState<string[]>([]);
  const handlePostUnlocked = (postId: string) => {
    setLocallyUnlockedPostIds(prev => [...new Set([...prev, postId])]);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch only PUBLIC posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('contentType', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(60)
        );
        const postsSnap = await getDocs(postsQuery);
        const publicPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost));

        // 2. Fetch Creator PROMO CARDS
        const creatorsQuery = query(collection(db, 'users'), where('isCreator', '==', true), limit(30));
        const creatorsSnap = await getDocs(creatorsQuery);
        const allPromos = creatorsSnap.docs
            .map(doc => (doc.data() as UserProfile).promoCard)
            .filter(p => !!p) as PromoCard[];

        // 3. Interleaving Logic
        const chunks: { type: 'posts' | 'promo', data: any }[] = [];
        const POSTS_PER_CHUNK = 8;
        
        for (let i = 0; i < publicPosts.length; i += POSTS_PER_CHUNK) {
            const chunk = publicPosts.slice(i, i + POSTS_PER_CHUNK);
            chunks.push({ type: 'posts', data: chunk });
            
            // Insert carousel after every 8 posts
            if (allPromos.length > 0) {
                // Shuffle and take a subset for variety
                const promoSubset = [...allPromos].sort(() => 0.5 - Math.random()).slice(0, 6);
                chunks.push({ type: 'promo', data: promoSubset });
            }
        }

        // Handle empty feed (unlikely but safe)
        if (chunks.length === 0) {
            // We could add dummy/AI content here
        }

        setContentChunks(chunks);

      } catch (error) {
        console.error("Error fetching Discover data: ", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const allUnlockedPostIds = [ ...new Set([...(user?.unlockedPostIds || []), ...locallyUnlockedPostIds]) ];
  const subscribedToCreatorIds = user?.activeSubscriptionIds || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-[0.3em] text-[10px]">
                <Sparkles className="w-3 h-3" /> Discover Universe
            </div>
            <h1 className="text-6xl font-black font-headline tracking-tighter leading-none">The Feed</h1>
            <p className="text-muted-foreground font-medium max-w-md">Accessing the public layer of the sovereign creator economy.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Universal Rate</p>
                    <p className="text-sm font-black text-primary">1 ULC = 0.015 USDT</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                    <Zap className="text-primary w-5 h-5 fill-current" />
                </div>
            </div>
        </div>
      </header>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-headline animate-pulse">Syncing Sovereign Feed...</p>
        </div>
      ) : (
        <div className="space-y-16 pb-20">
            {contentChunks.map((chunk, index) => (
                <div key={`${chunk.type}-${index}`} className="space-y-8">
                    {chunk.type === 'posts' ? (
                        <PostGrid 
                            postsToShow={chunk.data}
                            unlockedPostIds={allUnlockedPostIds}
                            subscribedToCreatorIds={subscribedToCreatorIds}
                            onPostUnlocked={handlePostUnlocked}
                        />
                    ) : (
                        <section className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <Megaphone className="w-5 h-5 text-primary" />
                                    <h2 className="text-xl font-headline font-bold uppercase tracking-widest">Featured</h2>
                                </div>
                                <Link href="/muses" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">View All Muses</Link>
                            </div>
                            <PromoCarousel promos={chunk.data} />
                        </section>
                    )}
                </div>
            ))}
        </div>
      )}
    </div>
  );
}


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
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function DiscoverPage() {
  const t = useTranslations('Discover');
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [promoCards, setPromoCards] = useState<PromoCard[]>([]);
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
        const postsQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const postsSnap = await getDocs(postsQuery);
        const publicPosts = postsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContentPost))
            .filter(post => post.contentType === 'public');

        setPosts(publicPosts);

        // Fetch promo cards from active creators
        const usersSnap = await getDocs(query(collection(db, 'users'), where('isCreator', '==', true)));
        const promos = usersSnap.docs
            .map(doc => doc.data().promoCard)
            .filter(Boolean) as PromoCard[];
        setPromoCards(promos);

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
            <h1 className="text-6xl font-black font-headline tracking-tighter leading-none">{t('feed')}</h1>
            <p className="text-muted-foreground font-medium max-w-md">{t('description')}</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Universal Rate</p>
                    <p className="text-sm font-black text-primary">1 ULC = 0.015 USDT</p>
                </div>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                    <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
                </div>
            </div>
        </div>
      </header>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-headline animate-pulse">{t('syncing')}</p>
        </div>
      ) : (
        <div className="space-y-16 pb-20">
            {posts.length > 0 ? (
                 <PostGrid 
                    postsToShow={posts}
                    unlockedPostIds={allUnlockedPostIds}
                    subscribedToCreatorIds={subscribedToCreatorIds}
                    onPostUnlocked={handlePostUnlocked}
                    promoCards={promoCards}
                />
            ) : (
                <div className="text-center py-20">
                    <p className="text-muted-foreground">{t('noContent')}</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
}

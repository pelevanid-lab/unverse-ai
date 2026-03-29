
"use client"

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost, UserProfile, PromoCard } from '@/lib/types';
import { VerticalFeed } from '@/components/discover/VerticalFeed';
import { useWallet } from '@/hooks/use-wallet';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getSystemConfig } from '@/lib/ledger';

export default function DiscoverPage() {
  const t = useTranslations('Discover');
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [promoCards, setPromoCards] = useState<PromoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [floorPrice, setFloorPrice] = useState(0.015);
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
        const frozenSnap = await getDocs(query(collection(db, 'users'), where('isFrozen', '==', true)));
        const frozenIds = new Set(frozenSnap.docs.map(d => d.id));

        const postsSnap = await getDocs(postsQuery);
        const publicPosts = postsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ContentPost))
            .filter(post => post.contentType === 'public' && !frozenIds.has(post.creatorId));

        setPosts(publicPosts);

        const usersSnap = await getDocs(query(collection(db, 'users'), where('isCreator', '==', true)));
        const promos = usersSnap.docs
            .map(docSnap => {
                const userData = docSnap.data() as UserProfile;
                if (!userData.promoCard || userData.isFrozen) return null;
                return {
                    ...userData.promoCard,
                    creatorAvatar: userData.avatar || (userData as any).photoURL || userData.promoCard.creatorAvatar || ""
                };
            })
            .filter(Boolean) as PromoCard[];
        setPromoCards(promos);

        const config = await getSystemConfig();
        if (config.protocolFloorPrice) {
            setFloorPrice(config.protocolFloorPrice);
        }

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
    <div className="w-full max-w-2xl mx-auto py-4 md:py-8 space-y-8">
      {/* Feed Header */}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-headline animate-pulse">{t('syncing')}</p>
        </div>
      ) : (
        <div className="pb-20">
            {posts.length > 0 ? (
                 <VerticalFeed 
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

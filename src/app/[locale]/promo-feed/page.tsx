"use client"

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PromoFeedItem } from '@/components/discover/PromoFeedItem';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, PromoCard } from '@/lib/types';
import { Loader2, X } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function PromoFeedPage() {
  const t = useTranslations('Discover');
  const searchParams = useSearchParams();
  const router = useRouter();
  const startCreatorId = searchParams.get('start');
  const [promoCards, setPromoCards] = useState<PromoCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hide standard page scrollbars when entering the immersive feed
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch users who are creators
        const usersSnap = await getDocs(query(collection(db, 'users'), where('isCreator', '==', true)));
        
        let promos = usersSnap.docs
            .map(docSnap => {
                const userData = docSnap.data() as UserProfile;
                // Exclude frozen accounts or missing promo cards
                if (!userData.promoCard || userData.isFrozen) return null;
                return {
                    ...userData.promoCard,
                    // Ensure we always have an avatar
                    creatorAvatar: userData.avatar || (userData as any).photoURL || userData.promoCard.creatorAvatar || ""
                };
            })
            .filter(Boolean) as PromoCard[];
            
        // If a start parameter is passed, place that card at the beginning (index 0)
        if (startCreatorId && promos.length > 0) {
            const index = promos.findIndex(p => p.creatorId === startCreatorId);
            if (index > -1) {
                const [target] = promos.splice(index, 1);
                promos.unshift(target);
            }
        }

        // Create an "infinite" feel by repeating the list
        const repeatedPromos = Array(10).fill(promos).flat();
        setPromoCards(repeatedPromos);
      } catch (error) {
        console.error("Error fetching Promo Feed data: ", error);
      }
      setLoading(false);
    };

    fetchData();
  }, [startCreatorId]);

  if (loading) {
    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-headline animate-pulse">{t('syncing')}</p>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[9999] h-[100dvh] w-screen isolate overflow-hidden">
        {/* Immersive Close Button - Routes back to home */}
        <button 
            onClick={() => router.push('/')}
            className="absolute top-6 right-6 lg:top-10 lg:right-10 z-[10000] p-3 rounded-full bg-black/40 backdrop-blur-md text-white/80 hover:bg-black/80 hover:text-white transition-all active:scale-95 border border-white/20 shadow-2xl"
        >
            <X className="w-6 h-6" />
        </button>

        {/* Scroll Container */}
        <div 
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory bg-black"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }} // Hide scrollbar for Chrome/Safari/Firefox
        >
            <style jsx global>{`
                /* Webkit scrollbar hiding fallback */
                ::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            
            {promoCards.length > 0 ? (
                promoCards.map((promo, idx) => (
                    <PromoFeedItem key={`${promo.creatorId}-${idx}`} promo={promo} />
                ))
            ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                    <p className="text-muted-foreground">{t('noContent')}</p>
                </div>
            )}
        </div>
    </div>
  );
}

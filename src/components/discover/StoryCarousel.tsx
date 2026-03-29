"use client"

import { PromoCard } from '@/lib/types';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useTranslations } from 'next-intl';

interface StoryCarouselProps {
  promoCards: PromoCard[];
}

export function StoryCarousel({ promoCards }: StoryCarouselProps) {
  const { user, isConnected } = useWallet();
  const t = useTranslations('Discover');

  if (!promoCards || promoCards.length === 0) return null;

  return (
    <div className="w-full bg-background/50 border-b border-white/5 py-4">
      <div 
        className="flex overflow-x-auto gap-4 px-4 scrollbar-none items-center" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* User's Story (Add Story) */}
        {isConnected && (
            <Link href="/creator/promo-card" className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
                <div className="relative p-[2px] rounded-full border border-white/10 group-hover:border-primary/50 transition-colors">
                    <Avatar className="w-16 h-16 md:w-20 md:h-20 border-2 border-background">
                        <AvatarImage src={user?.avatar || ""} />
                        <AvatarFallback className="bg-primary/10 text-lg">{user?.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-5 h-5 md:w-6 md:h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center text-white">
                        <Plus className="w-3 h-3 md:w-4 md:h-4 stroke-[3px]" />
                    </div>
                </div>
                <span className="text-[10px] md:text-xs text-muted-foreground font-medium truncate w-16 md:w-20 text-center group-hover:text-primary transition-colors">{t('yourCard')}</span>
            </Link>
        )}

        {/* Promo Stories */}
        {promoCards.map((promo, idx) => (
          <Link 
            key={idx} 
            href={`/promo-feed?start=${promo.creatorId}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className="p-[3px] rounded-full bg-gradient-to-tr from-yellow-400 via-primary to-fuchsia-600 animate-in zoom-in-50 duration-500">
                <div className="p-[2px] rounded-full bg-background">
                    <Avatar className="w-16 h-16 md:w-20 md:h-20 border-2 border-background">
                        <AvatarImage src={promo.creatorAvatar} className="object-cover" />
                        <AvatarFallback className="bg-primary/20 text-lg">{promo.creatorName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </div>
            </div>
            <span className="text-[10px] md:text-xs text-foreground font-medium truncate w-16 md:w-20 text-center group-hover:text-primary transition-colors">
                {promo.creatorName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

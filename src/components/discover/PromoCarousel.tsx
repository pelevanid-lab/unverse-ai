import { PromoCard } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PromoCarouselProps {
  promoCards: PromoCard[];
}

export function PromoCarousel({ promoCards }: PromoCarouselProps) {
  if (!promoCards || promoCards.length === 0) return null;

  return (
    <div className="w-full py-8 space-y-6">
      <div className="flex items-center gap-2 px-2">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        <h2 className="text-xl font-headline font-bold uppercase tracking-widest text-muted-foreground">Featured Creators</h2>
      </div>
      
      <div className="flex overflow-x-auto gap-6 pb-6 snap-x snap-mandatory pt-2 px-2 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {promoCards.map((promo, idx) => (
          <div key={idx} className="min-w-[320px] md:min-w-[400px] snap-center shrink-0">
            <div className="relative h-[220px] rounded-[2rem] overflow-hidden group border border-white/10 shadow-2xl bg-card">
              {/* Cover Image */}
              <div className="absolute inset-0">
                <img 
                  src={promo.imageUrl || 'https://picsum.photos/seed/promo/800/400'} 
                  alt={promo.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              </div>

              {/* Content */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold font-headline leading-tight">{promo.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{promo.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${promo.creatorId}`} className="flex items-center gap-2 group/creator">
                      <Avatar className="w-8 h-8 border-2 border-primary/20 group-hover/creator:border-primary transition-colors">
                        <AvatarImage src={promo.creatorAvatar} />
                        <AvatarFallback>{promo.creatorName?.charAt(0) || 'C'}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-bold text-muted-foreground group-hover/creator:text-white transition-colors">{promo.creatorName}</span>
                    </Link>
                    
                    <Link href={`/profile/${promo.creatorId}`}>
                      <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90 font-bold gap-2 text-xs h-8 px-4">
                        {promo.ctaText || 'Explore'} <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Hide scrollbar styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}

"use client"

import { PromoCard } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useRef, useEffect, useState } from 'react';

interface PromoFeedItemProps {
  promo: PromoCard;
}

export function PromoFeedItem({ promo }: PromoFeedItemProps) {
  // Check if media is a video to support future video feature
  const isVideo = promo.imageUrl?.toLowerCase().includes('.mp4') || 
                  promo.imageUrl?.toLowerCase().includes('.webm') ||
                  promo.imageUrl?.toLowerCase().includes('.mov');

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isVideo && videoRef.current) {
        // Reset loading state when promo changes
        setIsLoaded(false);
        // Try to play explicitly
        videoRef.current.play().catch(err => {
            console.warn("Autoplay blocked or failed:", err);
        });
    }
  }, [isVideo, promo.imageUrl]);

  return (
    <div className="w-full h-[100dvh] flex items-center justify-center snap-start snap-always relative overflow-hidden bg-[#0A0A0A]">
        {/* Blurred background for desktop aesthetics */}
        {promo.imageUrl && (
            isVideo ? (
                <div className="absolute inset-0 bg-black lg:block hidden" />
            ) : (
                <img 
                    src={promo.imageUrl} 
                    className="absolute inset-0 w-full h-[100dvh] object-cover blur-[80px] opacity-40 scale-110 lg:block hidden" 
                    alt="" 
                />
            )
        )}

        {/* The 9:16 Frame */}
        <div className="relative w-full h-full lg:max-w-[calc(100dvh*9/16)] lg:border-x lg:border-white/5 lg:shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden bg-black">
            {/* Loading skeleton background */}
            <div className="absolute inset-0 bg-muted animate-pulse -z-10" />
            
            {/* Media Layer */}
            {promo.imageUrl && (
                isVideo ? (
                    <>
                        {/* Static Thumbnail Placeholder for instant first-frame look */}
                        {promo.thumbnailUrl && !isLoaded && (
                            <img 
                                src={promo.thumbnailUrl} 
                                className="absolute inset-0 w-full h-full object-cover z-[1]" 
                                alt="Loading..." 
                            />
                        )}
                        <video 
                            ref={videoRef}
                            src={promo.imageUrl} 
                            poster={promo.thumbnailUrl}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            onPlaying={() => setIsLoaded(true)}
                            onCanPlay={() => {
                                if (!isLoaded) setIsLoaded(true);
                                videoRef.current?.play();
                            }}
                        />
                    </>
                ) : (
                    <img 
                        src={promo.imageUrl} 
                        className="absolute inset-0 w-full h-full object-cover" 
                        alt={promo.title} 
                    />
                )
            )}
            
            {/* Gradient Overlays for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
            
            {/* Top User Info (Clickable) */}
            <Link 
                href={`/profile/${promo.creatorId}`} 
                className="absolute top-16 left-6 right-6 flex items-center gap-3 z-10 hover:translate-x-1 transition-transform"
            >
                <Avatar className="w-12 h-12 border-2 border-white/20 shadow-lg">
                    <AvatarImage src={promo.creatorAvatar} className="object-cover" />
                    <AvatarFallback className="bg-primary/20 text-white font-bold">{promo.creatorName?.[0] || 'C'}</AvatarFallback>
                </Avatar>
                <span className="text-base font-bold text-white drop-shadow-lg tracking-wide truncate">{promo.creatorName}</span>
            </Link>

            {/* Bottom Content block */}
            <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 space-y-6 z-10 w-full">
                <div className="space-y-3">
                    <h3 className="text-3xl font-headline font-black text-white leading-tight drop-shadow-xl tracking-tight">
                        {promo.title}
                    </h3>
                    {promo.description && (
                        <p className="text-base text-white/90 drop-shadow-md line-clamp-3 font-medium">
                            {promo.description}
                        </p>
                    )}
                </div>
                
                {/* Call to Action */}
                <Link href={`/profile/${promo.creatorId}`} className="block w-full">
                    <Button className="w-full h-14 rounded-2xl font-black text-lg bg-white text-black hover:bg-neutral-200 active:scale-[98%] transition-all shadow-2xl">
                        {promo.ctaText || "Subscribe"}
                    </Button>
                </Link>
            </div>
        </div>
    </div>
  );
}

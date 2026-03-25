
"use client";

import { useState, useEffect, useRef } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { handleUnlock } from '@/lib/unlock';
import { getPostMediaAction } from '@/lib/ledger';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, X, Clock, Sparkles, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from '@/i18n/routing';
import { useRouter, useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface PostViewerModalProps {
  post: ContentPost;
  creator: UserProfile;
  isSubscribed: boolean;
  unlockedPostIds: string[];
  onClose: () => void;
  onPostUnlocked: (postId: string) => void;
}

export function PostViewerModal({ post, creator, isSubscribed, unlockedPostIds, onClose, onPostUnlocked }: PostViewerModalProps) {
  const { user: currentUser, isConnected } = useWallet();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('Post');
  const tWallet = useTranslations('Wallet');
  const [unlocking, setUnlocking] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [secureMediaUrl, setSecureMediaUrl] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [serialNumber, setSerialNumber] = useState<number | null>(null);
  const overlayTimeout = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOwner = currentUser?.uid === creator.uid;
  const isUnlocked = unlockedPostIds.includes(post.id);
  const canViewMedia = isOwner || post.contentType === 'public' || isUnlocked;
  
  // Use secure URL if available, fallback to post.mediaUrl if public
  const mediaUrl = secureMediaUrl || (post.contentType === 'public' ? post.mediaUrl : null);
  const isImage = post.mediaType === 'image' || (!post.mediaType && mediaUrl && (mediaUrl.includes('.webp') || mediaUrl.includes('.png') || mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('image')));
  
  const isSoldOut = post.contentType === 'limited' && post.limited && post.limited.soldCount >= post.limited.totalSupply;
  const currentPrice = (post.contentType === 'limited' ? post.limited?.price : post.unlockPrice) || 0;

  // Handle explicit video playback when source is loaded
  useEffect(() => {
    if (mediaUrl && !isImage && videoRef.current) {
        videoRef.current.play().catch(err => {
            console.error("Autoplay failed:", err);
        });
    }
  }, [mediaUrl, isImage]);

  useEffect(() => {
    async function fetchSecureMedia() {
        if (!canViewMedia || !post.id || !currentUser) return;
        
        setLoadingMedia(true);
        try {
            // 1. Fetch Secure 30-min URL
            const { url } = await getPostMediaAction(post.id);
            setSecureMediaUrl(url);

            // 2. Fetch Serial Number if limited
            if (post.contentType === 'limited' && !isOwner) {
                const unlockRef = doc(db, 'users', currentUser.uid, 'unlocked_media', post.id);
                const unlockSnap = await getDoc(unlockRef);
                if (unlockSnap.exists()) {
                    setSerialNumber(unlockSnap.data().serialNumber);
                }
            }
        } catch (error) {
            console.error("Error fetching secure media:", error);
        } finally {
            setLoadingMedia(false);
        }
    }

    fetchSecureMedia();

    if (isImage) {
      setShowOverlay(true);
      return;
    }
    if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    if (showOverlay) {
      overlayTimeout.current = setTimeout(() => setShowOverlay(false), 3500);
    }
    return () => {
      if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    };
  }, [showOverlay, isImage, canViewMedia, post.id, currentUser, isOwner, post.contentType]);

  const handleUnlockPost = async () => {
    if (!currentUser || !isConnected) {
      toast({ title: tWallet('connectToContinue'), description: tWallet('authRequiredDesc') });
      return;
    }
    if (isSoldOut) {
        toast({ title: t('soldOut'), description: t('exclusiveDesc'), variant: "destructive" });
        return;
    }

    setUnlocking(true);
    try {
      await handleUnlock(currentUser, post);
      toast({ title: tWallet('purchaseSuccess'), description: tWallet('purchaseSuccessDesc', { ulc: currentPrice }) });
      onPostUnlocked(post.id);
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_BALANCE") {
        toast({ 
            title: tWallet('errorTitle'), 
            description: tWallet('profileNotLoaded'), 
            variant: "destructive" 
        });
        setTimeout(() => {
            onClose();
            router.push('/wallet');
        }, 2000);
      } else {
        toast({ title: tWallet('purchaseFailed'), description: error.message || tWallet('defaultError'), variant: "destructive" });
      }
    } finally {
      setUnlocking(false);
    }
  };
  
  const isOverlayVisible = isImage || showOverlay;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-screen h-screen p-4 flex items-center justify-center bg-black border-0 overflow-hidden">
        <DialogTitle className="sr-only">Content by {creator.username}</DialogTitle>
        <DialogDescription className="sr-only">{post.content || 'A post from the creator.'}</DialogDescription>
        
        <div className="relative w-full h-full flex items-center justify-center" onClick={() => !isImage && setShowOverlay(true)}>
          
          <div className="relative flex justify-center items-center w-full h-full">
            {!canViewMedia ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-8 z-30 animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6 relative border border-primary/30">
                        {post.contentType === 'limited' ? (
                            <Clock className="w-12 h-12 text-yellow-400" />
                        ) : (
                            <Lock className="w-12 h-12 text-primary" />
                        )}
                        <div className="absolute -top-1 -right-1 bg-background p-1.5 rounded-full border border-white/10">
                            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                        </div>
                    </div>
                    
                    <h2 className="text-4xl font-bold font-headline mb-3 tracking-tight">
                        {post.contentType === 'limited' ? t('limitedEdition') : t('premiumContent')}
                    </h2>
                    <p className="text-muted-foreground mb-8 max-w-sm text-lg italic">
                        {post.contentType === 'limited' 
                            ? t('exclusiveDesc') 
                            : t('individualPriceDesc')}
                    </p>
                    
                    {isSoldOut ? (
                        <Button disabled size="lg" className="w-full max-w-xs h-16 rounded-2xl font-bold text-xl bg-muted text-muted-foreground uppercase tracking-widest">
                            {t('soldOut')}
                        </Button>
                    ) : (
                        <Button 
                            onClick={(e) => { e.stopPropagation(); handleUnlockPost(); }} 
                            disabled={unlocking} 
                            size="lg" 
                            className="w-full max-w-xs h-16 rounded-2xl gap-3 font-bold text-xl shadow-2xl shadow-primary/40 hover:scale-105 transition-transform"
                        >
                            {unlocking ? <Loader2 className="animate-spin w-6 h-6" /> : <Wallet className="w-6 h-6" />} 
                            {t('unlockFor', { price: currentPrice })}
                        </Button>
                    )}
                    
                    {post.contentType === 'limited' && post.limited && (
                         <div className="mt-4 flex flex-col items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-500/60 bg-yellow-500/5 px-4 py-1 rounded-full border border-yellow-500/10">
                                {t('availability', { count: post.limited.totalSupply - post.limited.soldCount })}
                            </p>
                            {serialNumber && (
                                <p className="text-sm font-bold text-yellow-500 animate-pulse">
                                    {t('yourSerialNo', { serial: serialNumber, total: post.limited.totalSupply })}
                                </p>
                            )}
                         </div>
                    )}
                </div>
            ) : (loadingMedia ? (
                <div className="flex flex-col items-center gap-4 text-white/50">
                    <Loader2 className="animate-spin w-12 h-12" />
                    <p className="text-sm font-medium animate-pulse">{t('securingMedia')}</p>
                </div>
            ) : mediaUrl && (
                isImage ? (
                    <img src={mediaUrl} alt="Content" className="object-contain block max-w-full max-h-full transition-all duration-700 animate-in fade-in" />
                ) : (
                    <video 
                        ref={videoRef}
                        src={mediaUrl} 
                        controls 
                        autoPlay 
                        muted 
                        loop 
                        playsInline
                        className="object-contain block max-w-full max-h-full transition-all duration-700 animate-in fade-in" 
                    />
                )
            ))}
            
            {!canViewMedia && mediaUrl && (
                <div className="absolute inset-0 -z-10 opacity-40">
                    <img src={mediaUrl} className="w-full h-full object-cover blur-[100px]" alt="preview" />
                </div>
            )}
          </div>

          <div className={`absolute inset-0 z-20 transition-opacity duration-300 pointer-events-none ${isOverlayVisible ? 'opacity-100' : 'opacity-0'}`}>
            <header className="absolute top-0 left-0 right-0 flex items-start justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
              <Link href={`/profile/${creator.uid}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
                <div className="flex items-center gap-4 group">
                  <Avatar className="w-12 h-12 border-2 border-white/50 group-hover:border-primary transition-colors shadow-lg">
                    <AvatarImage src={creator.avatar} />
                    <AvatarFallback className="bg-primary/20">{creator.username ? creator.username[0] : 'C'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-white text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                        {creator.username}
                        {post.contentType === 'limited' && <Badge className="bg-yellow-400 text-black text-[10px] font-black h-5 px-2 leading-none uppercase rounded-md">{t('limited')}</Badge>}
                        {serialNumber && <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 text-[10px] font-bold">#{serialNumber}</Badge>}
                    </h3>
                    <p className="text-xs text-white/50 font-mono">{new Date(post.createdAt).toLocaleString(locale === 'ar' ? 'ar-SA' : locale)}</p>
                  </div>
                </div>
              </Link>
            </header>

            {(canViewMedia || post.contentType === 'public') && post.content && (
              <footer className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent">
                  <div className="max-w-3xl">
                    <p className="text-lg text-white font-medium leading-relaxed drop-shadow-xl">{post.content}</p>
                  </div>
              </footer>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

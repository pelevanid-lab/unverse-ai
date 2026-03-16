
"use client";

import { useState, useEffect, useRef } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { handleUnlock } from '@/lib/unlock';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

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
  const [unlocking, setUnlocking] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimeout = useRef<NodeJS.Timeout | null>(null);

  const isOwner = currentUser?.uid === creator.uid;
  const canView = isOwner || !post.isPremium || isSubscribed || unlockedPostIds.includes(post.id);
  const mediaUrl = post.media?.url || post.mediaUrl;
  const isImage = post.media?.type === 'image' || (mediaUrl && (mediaUrl.includes('.webp') || mediaUrl.includes('.png') || mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('image')));

  useEffect(() => {
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
  }, [showOverlay, isImage]);

  const handleInteraction = () => {
    if (!isImage) setShowOverlay(true);
  };

  const handleUnlockPost = async () => {
    if (!currentUser || !isConnected) {
      toast({ title: "Connect Wallet", description: "Please connect your wallet to unlock content." });
      return;
    }
    setUnlocking(true);
    try {
      await handleUnlock(currentUser, post);
      toast({ title: "Post Unlocked!", description: "You can now view this premium content." });
      onPostUnlocked(post.id);
    } catch (error: any) {
      toast({ title: "Unlock Failed", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };
  
  const isOverlayVisible = isImage || showOverlay;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-screen h-screen p-4 flex items-center justify-center bg-black/90 backdrop-blur-sm border-0">
        <div className="relative w-full h-full flex items-center justify-center" onClick={handleInteraction}>
          
          {/* Media element constrained to viewport dimensions */}
          <div className="relative flex justify-center items-center w-full h-full">
            {!canView ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-8 z-30">
                    <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
                    <h2 className="text-3xl font-bold font-headline mb-2">Content Locked</h2>
                    <p className="text-muted-foreground mb-6">Subscribe to {creator.username} or unlock this post to view.</p>
                    <Button onClick={(e) => { e.stopPropagation(); handleUnlockPost(); }} disabled={unlocking} size="lg" className="w-full max-w-xs h-14 rounded-2xl gap-2 font-bold text-lg">
                        {unlocking ? <Loader2 className="animate-spin" /> : <Lock className="w-5 h-5" />} Unlock for {post.unlockPrice} ULC
                    </Button>
                </div>
            ) : mediaUrl && (
                isImage ? (
                    <img src={mediaUrl} alt={post.caption || 'Post'} className="object-contain block max-w-full max-h-full" />
                ) : (
                    <video src={mediaUrl} controls autoPlay muted loop className="object-contain block max-w-full max-h-full" />
                )
            )}
          </div>

          {/* --- OVERLAY START --- */}
          <div className={`absolute inset-0 z-20 transition-opacity duration-300 pointer-events-none ${isOverlayVisible ? 'opacity-100' : 'opacity-0'}`}>
            <header className="absolute top-0 left-0 right-0 flex items-start justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
              <Link href={`/profile/${creator.uid}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
                <div className="flex items-center gap-3 group">
                  <Avatar className="w-11 h-11 border-2 border-white/80 group-hover:border-primary transition-colors">
                    <AvatarImage src={creator.avatar} />
                    <AvatarFallback>{creator.username ? creator.username[0] : 'C'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-primary transition-colors">{creator.username}</h3>
                    <p className="text-xs text-white/70">{new Date(post.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </Link>
              <Button variant="ghost" size="icon" onClick={onClose} className="bg-black/50 hover:bg-black/80 rounded-full w-10 h-10 pointer-events-auto">
                  <X className="w-6 h-6" />
              </Button>
            </header>

            {canView && post.caption && (
              <footer className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="text-base text-white font-medium">{post.caption}</p>
              </footer>
            )}
          </div>
          {/* --- OVERLAY END --- */}

        </div>
      </DialogContent>
    </Dialog>
  );
}

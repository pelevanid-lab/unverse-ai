
"use client";

import { ContentPost, UserProfile } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Coins, Lock, Gift, X, MessageCircle } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { handleTipping, handleUnlocking } from "@/lib/ledger";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PostViewerModalProps {
  post: ContentPost;
  creator: UserProfile;
  isSubscribed: boolean;
  onClose: () => void;
}

export function PostViewerModal({ post, creator, isSubscribed, onClose }: PostViewerModalProps) {
  const { user: currentUser, isConnected } = useWallet();
  const { toast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);

  const canView = !post.isPremium || isSubscribed || isUnlocked;

  const handleUnlockClick = async () => {
    if (!currentUser || !isConnected) {
      toast({ variant: "destructive", title: "Please connect your wallet" });
      return;
    }
    try {
      await handleUnlocking(currentUser, post, creator.walletAddress);
      setIsUnlocked(true);
      toast({ title: "Post Unlocked!" });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to unlock post" });
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent modal from closing if someone clicks fast
    toast({ title: "Liked!" });
  };
  
  const handleTipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Tipped!" });
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Comment section coming soon!" });
  };
  
  const isImage = post.mediaUrl.includes('.webp') || post.mediaUrl.includes('.png') || post.mediaUrl.includes('.jpg') || post.mediaUrl.includes('.jpeg') || post.mediaUrl.includes('image');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] flex flex-col glass-card p-0 border-0 bg-transparent">
        {/* Accessibility elements (Visually Hidden) */}
        <DialogTitle className="sr-only">Post by {creator.displayName}</DialogTitle>
        <DialogDescription className="sr-only">{post.caption || 'A media post'}</DialogDescription>

        <div className="relative w-full h-full flex items-center justify-center">
          
          {/* Close Button - Top Right */}
          <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-10 w-10 p-0 rounded-full bg-black/50 hover:bg-black/80 border-0">
              <X className="h-6 w-6" />
          </Button>

          {/* Media Content */}
          <div className="w-full h-full flex items-center justify-center bg-black/90 rounded-lg overflow-hidden">
            {canView ? (
                isImage ? (
                <img src={post.mediaUrl} alt={post.caption || 'post'} className="max-w-full max-h-full w-auto h-auto object-contain"/>
              ) : (
                <video src={post.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white">
                  <Lock className="w-20 h-20 text-primary mb-6"/>
                  <h3 className="text-2xl font-bold">Content Locked</h3>
                  <p className="text-lg text-muted-foreground mb-6">Subscribe or unlock to view this exclusive content.</p>
                  <Button onClick={handleUnlockClick} className="w-full max-w-sm gap-2 font-bold text-lg h-14 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Lock size={20}/> Unlock for {post.priceULC} ULC
                  </Button>
              </div>
            )}
          </div>

          {/* Interaction Icons & Caption - Bottom */}
          {canView && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white">
                <h2 className="text-2xl font-bold mb-2">{post.caption}</h2>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-white/80">
                        <div className="flex items-center gap-1.5">
                            <Heart size={18}/> 
                            <span>{post.likes || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Coins size={18}/> 
                            <span>{(post.earningsULC || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={handleLikeClick} variant="ghost" size="icon" className="rounded-full bg-black/30 hover:bg-white/20 hover:text-red-500">
                          <Heart className="h-6 w-6" />
                        </Button>
                         <Button onClick={handleCommentClick} variant="ghost" size="icon" className="rounded-full bg-black/30 hover:bg-white/20">
                          <MessageCircle className="h-6 w-6" />
                        </Button>
                        <Button onClick={handleTipClick} variant="ghost" size="icon" className="rounded-full bg-black/30 hover:bg-white/20 hover:text-primary">
                          <Gift className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

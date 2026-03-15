"use client"

import Image from 'next/image';
import { Lock, Coins, CheckCircle, Heart, MessageCircle, Share2 } from 'lucide-react';
import { ContentPost } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { recordTransaction } from '@/lib/ledger';

export function PostCard({ post }: { post: ContentPost }) {
  const { user, isConnected } = useWallet();
  const { toast } = useToast();

  const handleUnlock = async () => {
    if (!isConnected) {
      toast({ title: "Error", description: "Please connect your wallet first." });
      return;
    }

    if (user!.ulcBalance.available < post.price) {
      toast({ title: "Insufficient Balance", description: `You need ${post.price} ULC to unlock this content.` });
      return;
    }

    try {
      await recordTransaction({
        fromWallet: user!.walletAddress,
        toWallet: post.creatorId, // Simulating creator wallet
        amount: post.price,
        currency: 'ULC',
        type: 'premium_unlock',
        referenceId: post.id
      });
      toast({ title: "Success", description: "Content unlocked!" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to unlock content." });
    }
  };

  return (
    <Card className="overflow-hidden glass-card group">
      <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
        <Avatar className="w-10 h-10 border-2 border-primary/20">
          <AvatarImage src={post.creatorAvatar} />
          <AvatarFallback>{post.creatorName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-bold text-sm flex items-center gap-1">
            {post.creatorName}
            {post.creatorId.includes('ai') && <CheckCircle className="w-3 h-3 text-primary" />}
          </span>
          <span className="text-xs text-muted-foreground">@{post.creatorId}</span>
        </div>
      </CardHeader>
      
      <div className="relative aspect-square">
        <Image 
          src={post.mediaUrl} 
          alt={post.title}
          fill
          className={`object-cover transition-transform group-hover:scale-105 ${post.isPremium ? 'blur-lg scale-110 opacity-50' : ''}`}
        />
        {post.isPremium && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-primary/20 p-4 rounded-full mb-4 border border-primary/50">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-headline font-bold text-xl mb-1">Premium Content</h3>
            <p className="text-sm text-muted-foreground mb-4">Unlock for {post.price} ULC</p>
            <Button onClick={handleUnlock} className="gap-2 bg-primary hover:bg-primary/90 rounded-full px-8">
              <Coins className="w-4 h-4" /> Unlock
            </Button>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-bold text-lg mb-1">{post.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{post.caption}</p>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between">
        <div className="flex gap-4">
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-red-400 transition-colors">
            <Heart className="w-5 h-5" />
            <span className="text-xs font-medium">1.2k</span>
          </button>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">42</span>
          </button>
        </div>
        <button className="text-muted-foreground hover:text-primary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </CardFooter>
    </Card>
  );
}

"use client"

import Image from 'next/image';
import { Lock, Coins, CheckCircle, Heart, MessageCircle, Share2, Unlock } from 'lucide-react';
import { ContentPost } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { handlePremiumUnlock } from '@/lib/ledger';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export function PostCard({ post }: { post: ContentPost }) {
  const { user, isConnected } = useWallet();
  const { toast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUnlock = async () => {
      if (!user) return;
      
      if (user.uid === post.creatorId) {
        setIsUnlocked(true);
        return;
      }

      const qUnlock = query(
        collection(db, 'ledger'), 
        where('fromWallet', '==', user.walletAddress),
        where('referenceId', '==', post.id),
        where('type', '==', 'premium_unlock')
      );
      
      const qSub = query(
        collection(db, 'ledger'),
        where('fromWallet', '==', user.walletAddress),
        where('referenceId', '==', post.creatorId),
        where('type', '==', 'subscription_payment')
      );

      const [unlockSnap, subSnap] = await Promise.all([getDocs(qUnlock), getDocs(qSub)]);
      if (!unlockSnap.empty || !subSnap.empty) setIsUnlocked(true);
    };
    
    if (post.isPremium) {
      checkUnlock();
    } else {
      setIsUnlocked(true);
    }
  }, [user, post.id, post.isPremium, post.creatorId]);

  const handleUnlockClick = async () => {
    if (!isConnected || !user) {
      toast({ title: "Auth Required", description: "Connect your wallet to unlock." });
      return;
    }

    if (user.ulcBalance.available < post.price) {
      toast({ variant: 'destructive', title: "Insufficient ULC", description: `Required: ${post.price} ULC` });
      return;
    }

    setLoading(true);
    try {
      const creatorSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', post.creatorId)));
      const creatorData = creatorSnap.docs[0]?.data();
      
      if (!creatorData) throw new Error("Creator not found");

      await handlePremiumUnlock(user, creatorData.walletAddress, post.price, post.id);
      setIsUnlocked(true);
      toast({ title: "Content Unlocked", description: "Enjoy the full post!" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Unlock Failed", description: e.message });
    }
    setLoading(false);
  };

  const showLocked = post.isPremium && !isUnlocked;

  return (
    <Card className="overflow-hidden glass-card group border-white/10 hover:border-primary/50 transition-all duration-300">
      <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
        <Link href={`/profile/${post.creatorId}`}>
          <Avatar className="w-10 h-10 border-2 border-primary/20 hover:scale-105 transition-transform">
            <AvatarImage src={post.creatorAvatar} />
            <AvatarFallback>{post.creatorName[0]}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col">
          <Link href={`/profile/${post.creatorId}`} className="hover:text-primary transition-colors">
            <span className="font-bold text-sm flex items-center gap-1">
              {post.creatorName}
              {post.creatorId.includes('ai') && <CheckCircle className="w-3 h-3 text-primary" />}
            </span>
          </Link>
          <span className="text-xs text-muted-foreground">@{post.creatorId.slice(0, 10)}</span>
        </div>
      </CardHeader>
      
      <div className="relative aspect-square bg-muted/20">
        <Image 
          src={post.mediaUrl} 
          alt={post.title}
          fill
          className={`object-cover transition-all duration-500 ${showLocked ? 'blur-2xl scale-110 opacity-40' : 'group-hover:scale-105'}`}
        />
        {showLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-primary/20 p-5 rounded-full mb-4 border border-primary/50 backdrop-blur-md">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <h3 className="font-headline font-bold text-xl mb-1">Premium Post</h3>
            <p className="text-xs text-muted-foreground mb-6 max-w-[200px]">Unlock to view this exclusive content.</p>
            <Button onClick={handleUnlockClick} disabled={loading} className="gap-2 bg-primary hover:bg-primary/90 rounded-full px-10 py-6 text-lg shadow-lg shadow-primary/20">
              <Coins className="w-5 h-5" /> Unlock for {post.price} ULC
            </Button>
          </div>
        )}
        {!showLocked && post.isPremium && (
          <div className="absolute top-4 right-4 bg-green-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Unlock className="w-3 h-3" /> UNLOCKED
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
            <span className="text-xs font-medium">0</span>
          </button>
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">0</span>
          </button>
        </div>
        <button className="text-muted-foreground hover:text-primary transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </CardFooter>
    </Card>
  );
}


"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { UserProfile, ContentPost, CreatorProfile, LedgerEntry } from '@/lib/types';
import { handleSubscription, handleTipping } from '@/lib/ledger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Coins, Calendar, Loader2, Heart, Gift, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ProfileContentFeed } from '@/components/profile/ProfileContentFeed';

export default function PublicProfilePage() {
  const { uid } = useParams();
  const { user: currentUser, isConnected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [unlockedPostIds, setUnlockedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState('5');
  const [isTipDialogOpen, setIsTipDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handlePostUnlocked = (postId: string) => {
    setUnlockedPostIds(prev => [...new Set([...prev, postId])]);
  };

  useEffect(() => {
    if (!uid) return;

    const fetchProfile = async () => {
      const userDocRef = doc(db, 'users', uid as string);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        setProfile(userData);

        if (userData.isCreator) {
          const creatorDocRef = doc(db, 'creators', uid as string);
          const creatorSnap = await getDoc(creatorDocRef);
          if (creatorSnap.exists()) {
            setCreatorProfile(creatorSnap.data() as CreatorProfile);
          }
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    };

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('creatorId', '==', uid), orderBy('createdAt', 'desc')),
      async (snap) => {
        const postsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost));
        const premiumPostIds = postsData.filter(p => p.isPremium).map(p => p.id);
        
        let postsWithStats = postsData;

        if (premiumPostIds.length > 0) {
          const ledgerQuery = query(
            collection(db, 'ledger'),
            where('type', '==', 'premium_unlock'),
            where('referenceId', 'in', premiumPostIds)
          );
          const ledgerSnapshot = await getDocs(ledgerQuery);
          const unlocks = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);

          postsWithStats = postsData.map(post => {
            if (post.isPremium) {
              const postUnlocks = unlocks.filter(u => u.referenceId === post.id);
              post.unlockCount = postUnlocks.length;
              post.revenue = postUnlocks.reduce((sum, u) => sum + u.amount, 0);
            }
            return post;
          });
        }
        setPosts(postsWithStats);
      }
    );

    fetchProfile();
    return () => unsubPosts();
  }, [uid, router]);

  useEffect(() => {
    if (!currentUser || !uid) return;

    const qSub = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', currentUser.walletAddress),
      where('referenceId', '==', uid),
      where('type', '==', 'subscription_payment')
    );
    const unsubSub = onSnapshot(qSub, (snap) => setIsSubscribed(!snap.empty));

    const qUnlock = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', currentUser.walletAddress),
      where('type', '==', 'premium_unlock')
    );
    const unsubUnlock = onSnapshot(qUnlock, (snap) => {
        const ids = snap.docs.map(d => d.data().referenceId);
        setUnlockedPostIds(ids);
    });

    return () => { unsubSub(); unsubUnlock(); };
  }, [currentUser, uid]);

  const handleSubscribeClick = async () => {
    if (!isConnected || !currentUser) {
      toast({ title: "Connect Required", description: "Login to subscribe." });
      return;
    }
    
    setSubscribing(true);
    try {
      await handleSubscription(currentUser, profile?.walletAddress!, creatorProfile?.subscriptionPrice || 10, uid as string);
      setIsSubscribed(true);
      toast({ title: "Subscribed!", description: `You now have premium access to ${creatorProfile?.displayName || profile?.username}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Subscription Failed", description: e.message || "Check your balance." });
    }
    setSubscribing(false);
  };

  const handleSendTip = async () => {
    if (!isConnected || !currentUser || !profile) return;
    setTipping(true);
    try {
      await handleTipping(currentUser, profile.walletAddress, parseFloat(tipAmount), uid as string);
      toast({ title: "Tip Sent!", description: `You sent ${tipAmount} ULC to ${creatorProfile?.displayName || profile.username}.` });
      setIsTipDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Tipping Failed", description: e.message });
    }
    setTipping(false);
  };

  if (loading || !profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  const isSelf = currentUser?.uid === uid;
  const displayName = creatorProfile?.displayName || profile.username;
  const avatar = creatorProfile?.avatar || profile.avatar;
  const bio = creatorProfile?.creatorBio || profile.bio;
  const coverImage = creatorProfile?.coverImage;
  const subPrice = creatorProfile?.subscriptionPrice || 10;

  return (
    <div className="relative pb-12">
      <Button variant="ghost" onClick={() => router.back()} className="absolute top-6 left-6 z-20 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm rounded-full p-2 h-auto"><ArrowLeft className="w-5 h-5" /></Button>
      <header className="relative pt-24 pb-12 px-6 rounded-3xl overflow-hidden glass-card border-white/10 flex items-end">
        {coverImage && <img src={coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover -z-10" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent -z-10" />
        <div className="flex flex-col md:flex-row items-center gap-8 w-full">
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl shrink-0"><AvatarImage src={avatar} className="object-cover"/><AvatarFallback>{displayName[0]}</AvatarFallback></Avatar>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">{displayName}{profile.isCreator && <CheckCircle className="w-6 h-6 text-primary fill-primary/10" />}</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">{bio}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              {creatorProfile?.category && <Badge variant="secondary" className="gap-1"><Coins className="w-3 h-3" /> {creatorProfile.category}</Badge>}
              <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px] shrink-0">
            {isSubscribed ? (
              <Button disabled className="bg-green-500/20 text-green-400 border border-green-500/30 gap-2 h-14 rounded-2xl w-full"><Crown className="w-5 h-5" /> Subscribed</Button>
            ) : (
              <Button onClick={handleSubscribeClick} disabled={subscribing || isSelf} className="bg-primary hover:bg-primary/90 gap-2 h-14 rounded-2xl w-full font-bold shadow-lg shadow-primary/20">
                {subscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />} Subscribe ({subPrice} USDT)
              </Button>
            )}
            {/* Tip Button Dialog is removed from here, but logic remains */}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <main className="lg:col-span-3 space-y-6">
            <ProfileContentFeed posts={posts} creator={profile} isSubscribed={isSubscribed} unlockedPostIds={unlockedPostIds} onPostUnlocked={handlePostUnlocked} />
        </main>
      </div>
    </div>
  );
}

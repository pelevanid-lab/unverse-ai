
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, ContentPost, CreatorProfile } from '@/lib/types';
import { handleSubscription, handleTipping } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Coins, Calendar, Loader2, Heart, Gift, ArrowLeft, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { ProfileContentFeed } from '@/components/profile/ProfileContentFeed';

export default function PublicProfilePage() {
  const { uid } = useParams();
  const { user: currentUser, isConnected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [tipping, setTipping] = useState(false);
  const [tipAmount, setTipAmount] = useState('5');
  const [isTipDialogOpen, setIsTipDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
      (snap) => {
        setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
      }
    );

    fetchProfile();
    return () => unsubPosts();
  }, [uid, router]);

  useEffect(() => {
    if (!currentUser || !uid) return;
    const q = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', currentUser.walletAddress),
      where('referenceId', '==', uid),
      where('type', '==', 'subscription_payment')
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setIsSubscribed(true);
    });
    return () => unsub();
  }, [currentUser, uid]);

  const handleSubscribeClick = async () => {
    if (!isConnected || !currentUser) {
      toast({ title: "Connect Required", description: "Login to subscribe." });
      return;
    }
    
    setSubscribing(true);
    try {
      await handleSubscription(currentUser, profile?.walletAddress!, 10, uid as string);
      setIsSubscribed(true);
      toast({ title: "Subscribed!", description: `You now have premium access to ${creatorProfile?.username || profile?.username}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Subscription Failed", description: "Check your balance." });
    }
    setSubscribing(false);
  };

  const handleSendTip = async () => {
    if (!isConnected || !currentUser || !profile) return;
    setTipping(true);
    try {
      await handleTipping(currentUser, profile.walletAddress, parseFloat(tipAmount), uid as string);
      toast({ title: "Tip Sent!", description: `You sent ${tipAmount} ULC to ${creatorProfile?.username || profile.username}.` });
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
  const displayName = creatorProfile?.displayName || creatorProfile?.username || profile.username;
  const avatar = creatorProfile?.avatar || profile.avatar;
  const bio = creatorProfile?.creatorBio || profile.bio;
  const coverImage = creatorProfile?.coverImage;
  const followers = creatorProfile?.totalSubscribers || 0;
  const socialLinks = creatorProfile?.socialLinks;

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }
      return hostname;
    } catch (error) {
      return url;
    }
  };

  return (
    <div className="relative pb-12">
      <Button variant="ghost" onClick={() => router.back()} className="absolute top-6 left-6 z-20 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm rounded-full p-2 h-auto">
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <header className="relative pt-24 pb-12 px-6 rounded-3xl overflow-hidden glass-card border-white/10 flex items-end">
        {coverImage && 
          <img src={coverImage} alt="Cover image" className="absolute inset-0 w-full h-full object-cover -z-10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent -z-10" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 w-full">
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl shrink-0">
            <AvatarImage src={avatar} className="object-cover"/>
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
              {displayName}
              {profile.isCreator && <CheckCircle className="w-6 h-6 text-primary fill-primary/10" />}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">{bio}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              {creatorProfile?.category && <Badge variant="secondary" className="gap-1"><Coins className="w-3 h-3" /> {creatorProfile.category}</Badge>}
              <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px] shrink-0">
            {isSubscribed ? (
              <Button disabled className="bg-green-500/20 text-green-400 border border-green-500/30 gap-2 h-14 rounded-2xl w-full">
                <Crown className="w-5 h-5" /> Active Subscriber
              </Button>
            ) : (
              <Button 
                onClick={handleSubscribeClick} 
                disabled={subscribing || isSelf} 
                className="bg-primary hover:bg-primary/90 gap-2 h-14 rounded-2xl w-full font-bold shadow-lg shadow-primary/20"
              >
                {subscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                Subscribe (10 USDT)
              </Button>
            )}

            <Dialog open={isTipDialogOpen} onOpenChange={setIsTipDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={isSelf} className="h-12 rounded-2xl border-white/10 hover:bg-white/5 gap-2">
                  <Gift className="w-4 h-4" /> Tip Creator
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-white/10">
                <DialogHeader>
                  <DialogTitle>Support {displayName}</DialogTitle>
                  <DialogDescription>Your tip goes directly to the creator's wallet.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Tip Amount (ULC)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['5', '20', '50'].map(amt => (
                        <Button 
                          key={amt} 
                          variant={tipAmount === amt ? 'default' : 'outline'}
                          onClick={() => setTipAmount(amt)}
                          className="h-12 rounded-xl"
                        >
                          {amt}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Input 
                    type="number" 
                    value={tipAmount} 
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="Custom amount..."
                    className="bg-muted border-none h-12"
                  />
                </div>
                <DialogFooter>
                  <Button onClick={handleSendTip} disabled={tipping} className="w-full h-14 rounded-2xl gap-2">
                    {tipping ? <Loader2 className="animate-spin w-4 h-4" /> : <Heart className="w-4 h-4" />}
                    Send {tipAmount} ULC Tip
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="glass-card border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Followers</span>
                 <span className="font-bold">{followers}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Posts</span>
                 <span className="font-bold">{posts.length}</span>
               </div>
               {socialLinks?.x && (
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[10px] text-muted-foreground mb-2">External URL</p>
                  <Link href={socialLinks.x} target="_blank" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="w-4 h-4" />
                    {formatUrl(socialLinks.x)}
                  </Link>
                </div>
               )}
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-3 space-y-6">
            <ProfileContentFeed posts={posts} creator={profile} isSubscribed={isSubscribed}/>
        </main>
      </div>
    </div>
  );
}


"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, ContentPost } from '@/lib/types';
import { handleSubscription } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PostCard } from '@/components/feed/PostCard';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Coins, Calendar, Loader2 } from 'lucide-react';

export default function PublicProfilePage() {
  const { uid } = useParams();
  const { user: currentUser, isConnected } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const docRef = doc(db, 'users', uid as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        router.push('/');
      }
    };

    const fetchPosts = () => {
      const q = query(
        collection(db, 'content'),
        where('creatorId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      return onSnapshot(q, (snap) => {
        setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
      });
    };

    fetchProfile();
    const unsubPosts = fetchPosts();
    setLoading(false);

    return () => unsubPosts();
  }, [uid, router]);

  useEffect(() => {
    if (!currentUser || !uid) return;
    // Check for active subscription in ledger
    const q = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', currentUser.walletAddress),
      where('referenceId', '==', uid),
      where('type', '==', 'subscription_payment')
    );
    const unsub = onSnapshot(q, (snap) => {
      // For this prototype, any subscription record means subscribed
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
      // Mock USDT subscription: 10 USDT
      await handleSubscription(currentUser, profile?.walletAddress!, 10, uid as string);
      setIsSubscribed(true);
      toast({ title: "Subscribed!", description: `You now have premium access to ${profile?.username}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Subscription Failed", description: "Check your balance." });
    }
    setSubscribing(false);
  };

  if (loading || !profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <header className="relative py-12 px-6 rounded-3xl overflow-hidden glass-card border-white/10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent -z-10" />
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback>{profile.username[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
              {profile.username}
              {profile.isCreator && <CheckCircle className="w-6 h-6 text-primary fill-primary/10" />}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">{profile.bio}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              <Badge variant="secondary" className="gap-1"><Coins className="w-3 h-3" /> Creator</Badge>
              <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px]">
            {isSubscribed ? (
              <Button disabled className="bg-green-500/20 text-green-400 border border-green-500/30 gap-2 h-14 rounded-2xl w-full">
                <Crown className="w-5 h-5" /> Active Subscriber
              </Button>
            ) : (
              <Button 
                onClick={handleSubscribeClick} 
                disabled={subscribing || currentUser?.uid === uid} 
                className="bg-primary hover:bg-primary/90 gap-2 h-14 rounded-2xl w-full font-bold shadow-lg shadow-primary/20"
              >
                {subscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                Subscribe (10 USDT)
              </Button>
            )}
            <Button variant="outline" className="h-12 rounded-2xl border-white/10 hover:bg-white/5">Tip Creator</Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="glass-card border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Followers</span>
                 <span className="font-bold">12.4k</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Posts</span>
                 <span className="font-bold">{posts.length}</span>
               </div>
               <div className="pt-4 border-t border-white/5">
                 <p className="text-[10px] text-muted-foreground mb-2">Social Links</p>
                 <div className="flex gap-2">
                   <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">𝕏</div>
                   <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">📸</div>
                 </div>
               </div>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-headline font-bold">Content Feed</h2>
            <div className="flex gap-2">
              <Badge className="bg-primary">All Posts</Badge>
              <Badge variant="outline">Premium Only</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map(post => <PostCard key={post.id} post={post} />)}
            {posts.length === 0 && (
              <div className="col-span-full py-24 text-center glass-card rounded-3xl border-dashed border-2 border-white/5">
                <p className="text-muted-foreground">This creator hasn't posted anything yet.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

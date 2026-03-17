
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWallet } from '@/hooks/use-wallet';
import { Creator, ContentPost, UserProfile } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Crown, Lock, Loader2, Link as LinkIcon, Twitter } from 'lucide-react';
import { handleSubscription, handleUnlocking } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';

const NON_GENDER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Favatar_nongender.png?alt=media&token=e2587329-3733-4dc3-8ab3-71b04510b503';
const COVER_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Fcover_default.webp?alt=media&token=e024b433-2895-41a4-9548-6126685511dc';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;
  const { user, isConnected } = useWallet();
  const { toast } = useToast();

  const [creator, setCreator] = useState<Creator | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null); // Post ID being unlocked

  const isSubscribed = user?.activeSubscriptionIds?.includes(uid) ?? false;

  useEffect(() => {
    if (!uid) return;

    const creatorRef = doc(db, 'creators', uid);
    const unsubCreator = onSnapshot(creatorRef, (snapshot) => {
      if (snapshot.exists()) {
        setCreator(snapshot.data() as Creator);
      } else {
        // Handle case where creator profile doesn't exist
        console.log("Creator profile not found.");
      }
      setLoading(false);
    });

    const postsQuery = query(collection(db, 'posts'), where("creatorId", "==", uid), orderBy("createdAt", "desc"));
    const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
    });

    return () => {
      unsubCreator();
      unsubPosts();
    };
  }, [uid]);

  const handleSubscribe = async () => {
    if (!user || !creator) return;

    if (!user.paymentWalletAddress) {
        toast({
            variant: 'destructive',
            title: "Payment Wallet Not Configured",
            description: "Please configure your TRON payment wallet in Settings before subscribing.",
            action: <Button onClick={() => router.push('/mypage')}>Go to Settings</Button>
        });
        return;
    }

    const tronWeb = (window as any).tronWeb;
    if (!tronWeb || tronWeb.defaultAddress.base58.toLowerCase() !== user.paymentWalletAddress.toLowerCase()) {
        toast({ 
            variant: 'destructive', 
            title: "Incorrect Wallet for Payment", 
            description: `Please switch to your designated payment wallet (${user.paymentWalletAddress.slice(0, 6)}...) in TronLink to proceed.` 
        });
        return;
    }

    setSubscribing(true);
    try {
        await handleSubscription(user, creator, creator.subscriptionPrice, creator.uid);
        toast({ title: "Subscribed!", description: `You now have access to ${creator.username}\'s exclusive content.` });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Subscription failed", description: error.message });
    } finally {
        setSubscribing(false);
    }
  };

  const handleUnlock = async (post: ContentPost) => {
    if (!user || !creator) return;
    if (!post.isPremium || !post.priceULC) return;

    if (user.ulcBalance.available < post.priceULC) {
        toast({ variant: 'destructive', title: "Insufficient ULC", description: "You don\'t have enough ULC to unlock this post." });
        return;
    }

    setUnlocking(post.id);
    try {
        await handleUnlocking(user, post, creator.walletAddress);
        toast({ title: "Content Unlocked!", description: `You can now view ${post.title}.` });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Unlock failed", description: error.message });
    } finally {
        setUnlocking(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  }

  if (!creator) {
    return <div className="text-center py-20">Creator profile not found.</div>;
  }

  const socialLinks = creator.socialLinks || {};

  return (
    <div className="pb-12">
      <div className="h-48 md:h-64 bg-secondary relative">
        <img src={creator.coverImage || COVER_IMAGE} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute -bottom-16 left-6">
          <Avatar className="w-32 h-32 border-4 border-background shadow-lg">
            <AvatarImage src={creator.avatar || NON_GENDER_AVATAR} alt={creator.username} />
            <AvatarFallback>{creator.username[0]}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="pt-20 px-6 space-y-4">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold font-headline">{creator.username}</h1>
                <p className="text-muted-foreground">{creator.bio}</p>
                <div className="flex items-center gap-4 mt-2">
                    {socialLinks.twitter && <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Twitter size={18}/></a>}
                    {socialLinks.website && <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><LinkIcon size={18}/></a>}
                </div>
            </div>
            {isConnected && user?.uid !== uid && (
              <Button onClick={handleSubscribe} disabled={isSubscribed || subscribing} className="bg-primary hover:bg-primary/90 rounded-full px-8 shadow-lg">
                {subscribing ? <Loader2 className="animate-spin"/> : (isSubscribed ? 'Subscribed' : `Subscribe - ${creator.subscriptionPrice} ULC`)}
              </Button>
            )}
        </div>

        <Tabs defaultValue="content" className="w-full pt-4">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          <TabsContent value="content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {posts.map(post => {
                const isUnlocked = !post.isPremium || (user?.unlockedPostIds?.includes(post.id) ?? false) || isSubscribed;
                return (
                  <Card key={post.id} className="overflow-hidden relative">
                    <CardContent className="p-4">
                      <h3 className="font-bold truncate">{post.title}</h3>
                      <p className="text-xs text-muted-foreground h-10 overflow-hidden">{post.content}</p>
                    </CardContent>
                    {isUnlocked ? (
                        <Link href={`/post/${post.id}`} className="block p-4 bg-muted/30 text-center font-bold text-primary hover:bg-muted">
                           View Content
                        </Link>
                    ) : (
                      <div className="p-4 bg-black/50 text-center font-bold text-white flex items-center justify-center flex-col gap-2 h-full">
                        <Lock size={24} className="text-yellow-400"/>
                        <p>Unlock for {post.priceULC} ULC</p>
                        <Button size="sm" onClick={() => handleUnlock(post)} disabled={unlocking === post.id} className="w-full">
                          {unlocking === post.id ? <Loader2 className="animate-spin"/> : 'Unlock Now'}
                        </Button>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </TabsContent>
          <TabsContent value="about">
             <Card className="mt-6"><CardContent className="p-6"><p>{creator.bio || "No information available."}</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

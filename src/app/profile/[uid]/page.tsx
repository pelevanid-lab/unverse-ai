
"use client"

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWallet } from '@/hooks/use-wallet';
import { Creator, ContentPost, UserProfile, SystemConfig } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Crown, Lock, Loader2, Link as LinkIcon, Twitter, Star, AlertTriangle } from 'lucide-react';
import { handleSubscription, getSystemConfig } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const NON_GENDER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Favatar_nongender.png?alt=media&token=e2587329-3733-4dc3-8ab3-71b04510b503';
const COVER_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Fcover_default.webp?alt=media&token=e024b433-2895-41a4-9548-6126685511dc';

function SubscriptionDialog({ creator, user }: { creator: Creator; user: UserProfile; }) {
  const [open, setOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON' | null>(user.preferredPaymentNetwork || null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getSystemConfig().then(setSystemConfig);
  }, []);

  const handleConfirmSubscription = async () => {
    if (!selectedNetwork || !systemConfig) return;

    const userPaymentWallet = user.paymentWallets?.[selectedNetwork]?.address;
    const creatorPayoutWallet = creator.payoutWallets?.[selectedNetwork]?.address;

    if (!userPaymentWallet) {
      toast({ variant: 'destructive', title: 'Your Wallet is Missing', description: `Please connect a ${selectedNetwork} wallet in settings first.` });
      return;
    }
    if (!creatorPayoutWallet) {
      toast({ variant: 'destructive', title: 'Creator Wallet is Missing', description: `${creator.username} does not support payments on the ${selectedNetwork} network yet.` });
      return;
    }

    setIsSubscribing(true);
    try {
      // This is now a real on-chain USDT payment split
      await handleSubscription(user, creator, selectedNetwork, systemConfig);
      toast({ title: "Subscribed!", description: `You now have access to ${creator.username}\'s exclusive content.` });
      setOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Subscription Failed", description: error.message });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 rounded-full px-8 shadow-lg">Subscribe - ${creator.subscriptionPrice} USDT</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to {creator.username}</DialogTitle>
          <DialogDescription>Your payment will be sent directly to the creator and the platform on the blockchain.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="text-center">
            <span className="text-4xl font-bold">${creator.subscriptionPrice}</span>
            <span className="text-muted-foreground"> / month</span>
          </div>
          <RadioGroup value={selectedNetwork || ''} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')}>
            <Label>Select Payment Network</Label>
            <div className="space-y-2 pt-2">
               <div className={`flex items-center space-x-3 rounded-lg border p-3 ${!creator.payoutWallets?.TRON?.verified ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="TRON" id="s-tron" disabled={!creator.payoutWallets?.TRON?.verified}/>
                    <Label htmlFor="s-tron" className="flex-1 cursor-pointer">TRON</Label>
                     {!creator.payoutWallets?.TRON?.verified && <span className="text-xs text-muted-foreground">Not Supported</span>}
                </div>
                <div className={`flex items-center space-x-3 rounded-lg border p-3 ${!creator.payoutWallets?.TON?.verified ? 'opacity-50' : ''}`}>
                    <RadioGroupItem value="TON" id="s-ton" disabled={true} />
                    <Label htmlFor="s-ton" className="flex-1 cursor-pointer">TON (Coming Soon)</Label>
                    {!creator.payoutWallets?.TON?.verified && <span className="text-xs text-muted-foreground">Not Supported</span>}
                </div>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirmSubscription} disabled={!selectedNetwork || isSubscribing}>
            {isSubscribing ? <Loader2 className="animate-spin"/> : 'Confirm Subscription'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;
  const { user, isConnected } = useWallet();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  const isSubscribed = user?.activeSubscriptionIds?.includes(uid) ?? false;

  useEffect(() => {
    if (!uid) return;
    const creatorRef = doc(db, 'creators', uid);
    const unsubCreator = onSnapshot(creatorRef, (snap) => setCreator(snap.exists() ? (snap.data() as Creator) : null));
    
    const postsQuery = query(collection(db, 'posts'), where("creatorId", "==", uid), orderBy("createdAt", "desc"));
    const unsubPosts = onSnapshot(postsQuery, (snap) => setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost))));

    setLoading(false);
    return () => { unsubCreator(); unsubPosts(); };
  }, [uid]);


  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2/></div>;
  if (!creator) return <div className="text-center py-20">Creator profile not found.</div>;
  
  return (
    <div className="pb-12">
      {/* Profile Header and Bio... */}
      <div className="pt-20 px-6 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">{creator.username}</h1>
                    {/* Other details... */}
                </div>
                {isConnected && user?.uid !== uid && (
                    isSubscribed ? 
                    <Button disabled variant="secondary">Subscribed</Button> : 
                    <SubscriptionDialog creator={creator} user={user} />
                )}
            </div>
           {/* Post Tabs and Content... */}
      </div>
    </div>
  );
}

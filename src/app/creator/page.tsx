
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart3, Settings, Upload, DollarSign, Coins, ArrowUpRight, Loader2, ExternalLink, ArrowLeft, Sparkles, Image, Video, Wallet, ChevronRight } from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, setDoc, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { Creator, UserProfile, CreatorMedia, ContentPost } from '@/lib/types';
import Link from 'next/link';
import { ImageUploader } from '@/components/creator/ImageUploader';
import { ContainerTab } from '@/components/creator/ContainerTab';
import { PublishContentsTab } from '@/components/creator/PublishContentsTab';
import { StatsTab } from '@/components/creator/StatsTab';
import { useRouter } from 'next/navigation';


function CollectionWalletsLinkCard() {
    const router = useRouter();

    return (
        <Card className="glass-card max-w-2xl mx-auto border-white/10 mt-6">
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><Wallet className="w-5 h-5 text-primary"/> Collection Wallets</CardTitle>
                <CardDescription>Manage the TRON and TON wallets where you will receive your earnings.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => router.push('/creator/collection-wallets')} className='w-full'>
                    Manage Collection Wallets
                    <ChevronRight className="w-4 h-4 ml-2" />
                 </Button>
            </CardContent>
        </Card>
    );
}


function BecomeCreator({ onBecomeCreator, loading }: { onBecomeCreator: () => void, loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
       <Card className="glass-card max-w-2xl p-8 border-primary/20 shadow-2xl shadow-primary/10"> {/* ... */}</Card>
    </div>
  );
}

export default function CreatorPanel() {
  const { user, isConnected } = useWallet();
  const { toast } = useToast();

  const [activationLoading, setActivationLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('container');

  const [displayName, setDisplayName] = useState('');
  const [creatorBio, setCreatorBio] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);

  useEffect(() => {
    if (user?.isCreator && user.uid) {
      const unsub = onSnapshot(doc(db, 'creators', user.uid), (doc) => {
        if (doc.exists()) {
          const creatorData = doc.data() as Creator;
          setDisplayName(creatorData.username || '');
          setCreatorBio(creatorData.bio || '');
          setSubscriptionPrice(creatorData.subscriptionPrice || 0);
        }
      });
      return () => unsub();
    }
  }, [user]);

  const handleBecomeCreator = async () => { /* ... */ };

  const handleSettingsUpdate = async (e: FormEvent) => { /* ... */ };

  if (!isConnected || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <DollarSign className="w-16 h-16 text-primary" />
        <h1 className="text-3xl font-headline font-bold">Creator Portal</h1>
        <p className="text-muted-foreground">Connect your wallet to manage your content.</p>
      </div>
    );
  }

  if (!user.isCreator) {
    return <BecomeCreator onBecomeCreator={handleBecomeCreator} loading={activationLoading} />;
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-8 border-white/10">
        <div>
          <Link href="/mypage" className="mb-4 inline-block">{/* ... */}</Link>
          <h1 className="text-5xl font-headline font-bold gradient-text">Creator Panel</h1>
           <div className='flex items-center gap-4 mt-2'>
             <p className="text-muted-foreground">Manage your digital empire.</p>
             <div className="flex items-center gap-1">{/* ... */}</div>
           </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Link href="/wallet" className='w-full'>
            <Card className="glass-card border-primary/20 bg-primary/5 flex items-center justify-center text-center px-6 py-3 rounded-2xl h-full hover:bg-primary/10 transition-colors cursor-pointer">
              <div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Available Earnings</p>
                <p className="text-2xl font-bold font-headline">{user?.ulcBalance?.available.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ULC</span></p>
              </div>
            </Card>
          </Link>
          <Link href={`/profile/${user?.walletAddress}`} className="w-full">
            <Button variant="outline" className="h-full w-full rounded-2xl gap-2">
              <ExternalLink className="w-4 h-4" /> View Public Profile
            </Button>
          </Link>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 bg-muted/20 p-1 rounded-2xl border border-white/5 mb-8">
          <TabsTrigger value="container">Container</TabsTrigger>
          <TabsTrigger value="published">Publish Contents</TabsTrigger>
        </TabsList>

        <TabsContent value="container">
         <ContainerTab />
        </TabsContent>
        <TabsContent value="published">
          <PublishContentsTab />
        </TabsContent>
        <TabsContent value="analytics">
          <StatsTab />
        </TabsContent>

        <TabsContent value="settings">
          <Card className="glass-card max-w-2xl mx-auto border-white/10">{/* ... */}</Card>
          <CollectionWalletsLinkCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

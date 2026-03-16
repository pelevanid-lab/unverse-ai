
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BarChart3, Settings, Upload, DollarSign, Coins, ArrowUpRight, Loader2, ExternalLink, ArrowLeft, Sparkles, Image, Video } from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, setDoc, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { CreatorProfile, UserProfile, CreatorMedia, ContentPost } from '@/lib/types';
import Link from 'next/link';
import { ImageUploader } from '@/components/creator/ImageUploader';
import { ContainerTab } from '@/components/creator/ContainerTab';
import { PublishContentsTab } from '@/components/creator/PublishContentsTab';
import { StatsTab } from '@/components/creator/StatsTab';

function BecomeCreator({ onBecomeCreator, loading }: { onBecomeCreator: () => void, loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <Card className="glass-card max-w-2xl p-8 border-primary/20 shadow-2xl shadow-primary/10">
        <CardHeader className="p-0">
          <div className='flex justify-center mb-4'>
            <div className='p-4 bg-primary/10 rounded-full border border-primary/20'>
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-4xl font-headline gradient-text">Become a UNVERSE Creator</CardTitle>
          <CardDescription className="pt-2 text-base text-muted-foreground">
            Join our ecosystem to monetize your content, engage with your audience through tokenized interactions, and build your digital empire on a decentralized platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-8">
          <Button
            onClick={onBecomeCreator}
            disabled={loading}
            className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Activate Creator Profile'}
          </Button>
          <p className='text-xs text-muted-foreground mt-4'>Activation is instant. You can start publishing right away.</p>
        </CardContent>
      </Card>
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
  const [category, setCategory] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [avatar, setAvatar] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [premiumDefaultPrice, setPremiumDefaultPrice] = useState(0);

  useEffect(() => {
    if (!user) return;

    if (user.isCreator && user.walletAddress) {
      const fetchCreatorProfile = async () => {
        const creatorDocRef = doc(db, 'creators', user.walletAddress!);
        const creatorDoc = await getDoc(creatorDocRef);
        if (creatorDoc.exists()) {
          const creatorData = creatorDoc.data() as CreatorProfile;
          setDisplayName(creatorData.displayName || '');
          setCreatorBio(creatorData.creatorBio || '');
          setCategory(creatorData.category || '');
          setCoverImage(creatorData.coverImage || '');
          setAvatar(creatorData.avatar || '');
          setExternalUrl(creatorData.socialLinks?.x || '');
          setSubscriptionPrice(creatorData.subscriptionPrice || 0);
          setPremiumDefaultPrice(creatorData.premiumDefaultPrice || 0);
        }
      };
      fetchCreatorProfile();
    }
  }, [user]);

  const handleBecomeCreator = async () => {
    if (!user || !user.walletAddress) return;
    setActivationLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.walletAddress);
      const creatorDocRef = doc(db, 'creators', user.walletAddress);

      await setDoc(userDocRef, { isCreator: true }, { merge: true });

      const creatorDoc = await getDoc(creatorDocRef);
      if (!creatorDoc.exists()) {
        const freshUserDoc = await getDoc(userDocRef);
        if (!freshUserDoc.exists()) {
            throw new Error("User document could not be found or created.");
        }
        const freshUserData = freshUserDoc.data() as UserProfile;

        const newCreatorProfile: CreatorProfile = {
          uid: user.walletAddress,
          walletAddress: user.walletAddress,
          username: freshUserData.username || `creator_${user.walletAddress.substring(0, 8)}`,
          displayName: ''  ,
          avatar: freshUserData.avatar || '',
          coverImage: '',
          creatorBio: '',
          category: '',
          socialLinks: { x: '' },
          subscriptionPrice: 10,
          premiumDefaultPrice: 5,
          totalSubscribers: 0,
          totalUnlocks: 0,
          totalTips: 0,
          totalRevenue: 0,
          isActive: true,
          updatedAt: Date.now(),
          createdAt: Date.now(),
        };
        await setDoc(creatorDocRef, newCreatorProfile);
      }
      
      toast({ title: "Welcome, Creator!", description: "Your creator profile is now active." });

    } catch (error) {
      console.error("Activation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ variant: 'destructive', title: "Activation Failed", description: errorMessage });
    } finally {
      setActivationLoading(false);
    }
  };

  const handleSettingsUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !user.walletAddress) return;
    setSettingsLoading(true);
    try {
      const creatorDocRef = doc(db, 'creators', user.walletAddress);
      await updateDoc(creatorDocRef, {
        displayName,
        creatorBio,
        category,
        coverImage,
        avatar,
        socialLinks: { x: externalUrl },
        subscriptionPrice,
        premiumDefaultPrice,
        updatedAt: Date.now(),
      });
      toast({ title: "Profile Updated", description: "Your public profile has been saved." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Update Failed", description: "Could not save your profile." });
    }
    setSettingsLoading(false);
  };

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
          <Link href="/mypage" className="mb-4 inline-block">
            <Button variant="ghost" className="text-muted-foreground hover:text-white px-0 hover:bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to My Page
            </Button>
          </Link>
          <h1 className="text-5xl font-headline font-bold gradient-text">Creator Panel</h1>
           <div className='flex items-center gap-4 mt-2'>
             <p className="text-muted-foreground">Manage your digital empire.</p>
             <div className="flex items-center gap-1">
                <Button variant={activeTab === 'analytics' ? 'secondary' : 'ghost'} size='icon' onClick={() => setActiveTab('analytics')}><BarChart3 className="w-5 h-5"/></Button>
                <Button variant={activeTab === 'settings' ? 'secondary' : 'ghost'} size='icon' onClick={() => setActiveTab('settings')}><Settings className="w-5 h-5"/></Button>
             </div>
           </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Card className="glass-card border-primary/20 bg-primary/5 flex items-center gap-4 px-6 py-3 rounded-2xl">
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Available Earnings</p>
              <p className="text-2xl font-bold font-headline">{user?.ulcBalance.available.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ULC</span></p>
            </div>
            <Button size="sm" disabled className="rounded-xl gap-2">
              <ArrowUpRight className="w-4 h-4" />
              Withdraw
            </Button>
          </Card>
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
          <Card className="glass-card max-w-2xl mx-auto border-white/10">
            <CardHeader>
              <CardTitle>Creator Settings</CardTitle>
              <CardDescription>Customize your public profile and monetization rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettingsUpdate} className="space-y-6">
                <ImageUploader
                  label="Avatar Image"
                  currentImageUrl={avatar}
                  onUploadComplete={setAvatar}
                  recommendedSize="400x400px"
                  storagePath="avatars"
                  previewType='avatar'
                />
                <ImageUploader
                  label="Cover Image"
                  currentImageUrl={coverImage}
                  onUploadComplete={setCoverImage}
                  recommendedSize="1600x400px"
                  storagePath="covers"
                  previewType='cover'
                />
                 <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your public creator name" />
                </div>
                <div className="space-y-2">
                  <Label>External URL</Label>
                  <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://your-website.com" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Digital Artist" />
                </div>
                <div className="space-y-2">
                  <Label>Creator Bio</Label>
                  <Textarea value={creatorBio} onChange={(e) => setCreatorBio(e.target.value)} placeholder="Tell the world your story..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subscription Price (USDT)</Label>
                    <Input type="number" value={subscriptionPrice} onChange={(e) => setSubscriptionPrice(parseFloat(e.target.value))} placeholder="10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Premium Default Price (ULC)</Label>
                    <Input type="number" value={premiumDefaultPrice} onChange={(e) => setPremiumDefaultPrice(parseFloat(e.target.value))} placeholder="5" />
                  </div>
                </div>

                <Button type="submit" disabled={settingsLoading} className="w-full">
                  {settingsLoading ? <Loader2 className="animate-spin" /> : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

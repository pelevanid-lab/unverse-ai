
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, ExternalLink, ArrowLeft, Settings } from 'lucide-react';
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import Link from 'next/link';
import { ContainerTab } from '@/components/creator/ContainerTab';
import { PublishContentsTab } from '@/components/creator/PublishContentsTab';
import { CreatorSettingsTab } from '@/components/creator/CreatorSettingsTab';

function BecomeCreator({ onBecomeCreator, loading }: { onBecomeCreator: () => void, loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
       <Card className="glass-card max-w-2xl p-8 border-primary/20 shadow-2xl shadow-primary/10">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <DollarSign className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline">Become a Creator</CardTitle>
        <CardDescription className="mt-2 mb-6">Start your journey on Unverse, share your content, and earn directly from your supporters.</CardDescription>
        <Button onClick={onBecomeCreator} disabled={loading} size="lg" className='w-full'>
            {loading ? 'Activating...' : 'Activate Creator Profile'}
        </Button>
       </Card>
    </div>
  );
}

export default function CreatorPanel() {
  const { user, isConnected } = useWallet();
  const [activationLoading, setActivationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('container');
  const [showSettings, setShowSettings] = useState(false);

  const handleBecomeCreator = async () => {
      if (!user?.uid) return;
      setActivationLoading(true);
      try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
              isCreator: true,
              bio: 'Welcome to my Unverse!', // Set default bio
              creatorData: {
                  category: 'General',
                  coverImage: '',
                  subscriptionPriceMonthly: 10,
                  creatorStatus: 'active',
                  visibility: 'public',
              }
          });
      } catch (error: any) {
          console.error("Failed to activate creator profile:", error);
      } finally {
          setActivationLoading(false);
      }
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
            {showSettings && 
                 <Button variant="ghost" onClick={() => setShowSettings(false)} className="mb-4 text-muted-foreground gap-2 px-0 hover:bg-transparent hover:text-white">
                    <ArrowLeft className="w-4 h-4" /> Back to Panel
                 </Button>
            }
          <h1 className="text-5xl font-headline font-bold gradient-text">Creator Panel</h1>
           <div className='flex items-center gap-4 mt-2'>
             {!showSettings && (
                <Button variant="link" onClick={() => setShowSettings(true)} className="text-muted-foreground p-0 h-auto hover:text-primary">
                    Manage your digital empire.
                </Button>
             )}
           </div>
        </div>
        {!showSettings && (
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
        )}
      </header>

    {showSettings ? (
        <CreatorSettingsTab />
    ) : (
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
        </Tabs>
    )}
    </div>
  );
}

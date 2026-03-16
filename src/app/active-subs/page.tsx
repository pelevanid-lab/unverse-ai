
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Loader2, Crown } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/lib/types';

export default function ActiveSubsPage() {
  const { user, isConnected } = useWallet();
  const [activeSubs, setActiveSubs] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveSubs = async () => {
      // We now read directly from the user object's new array.
      if (!user || !user.activeSubscriptionIds || user.activeSubscriptionIds.length === 0) {
        setActiveSubs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const creatorUids = user.activeSubscriptionIds;
        // Per your brilliant design, we can now fetch creator profiles directly.
        const creatorsQuery = query(collection(db, 'users'), where('uid', 'in', creatorUids));
        const creatorSnaps = await getDocs(creatorsQuery);
        
        const subsData = creatorSnaps.docs.map(d => ({ ...d.data() } as User));
        setActiveSubs(subsData);

      } catch (error) {
        console.error("Failed to fetch active subscriptions:", error);
        setActiveSubs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSubs();
  }, [user]); // The only dependency is the user object.


  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full"><Sparkles className="w-12 h-12 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold">Access Your Content</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to view your active subscriptions.</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                <Crown className="w-8 h-8 text-yellow-400" /> Active Subscriptions
            </h1>
            <Link href="/mypage">
                <Button variant="outline">Back to Dashboard</Button>
            </Link>
        </div>

       {loading ? 
         <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div> : 
         (activeSubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSubs.map((sub) => (
                <Card key={sub.uid} className="glass-card border-white/10 hover:border-primary/30 transition-all">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="w-12 h-12"><AvatarImage src={sub.avatar} /><AvatarFallback>{sub.username[0]}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="font-bold">{sub.username}</p>
                    </div>
                    <Link href={`/profile/${sub.uid}`}><Button variant="ghost" size="sm">Visit Profile</Button></Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center space-y-4">
                    <p className="text-muted-foreground text-sm">You haven't subscribed to any creators yet.</p>
                    <Link href="/discover"><Button variant="outline" className="rounded-xl px-8 border-white/10">Explore Creators</Button></Link>
                </CardContent>
            </Card>
          ))}
    </div>
  );
}

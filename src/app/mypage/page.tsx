
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Coins, Crown, ArrowUpRight, ArrowDownLeft, Sparkles, LogOut, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, UserProfile } from '@/lib/types';

export default function MyPage() {
  const { user, isConnected, disconnectWallet } = useWallet();
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [recentUnlocks, setRecentUnlocks] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch subscriptions
    const qSubs = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', user.walletAddress),
      where('type', '==', 'subscription_payment')
    );
    
    const unsubSubs = onSnapshot(qSubs, async (snap) => {
      const subs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const creatorSnap = await getDoc(doc(db, 'users', data.referenceId));
        return { 
          id: d.id, 
          creator: creatorSnap.exists() ? creatorSnap.data() : null,
          ...data 
        };
      }));
      setActiveSubs(subs.filter(s => s.creator));
    });

    // Fetch premium unlocks
    const qUnlocks = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', user.walletAddress),
      where('type', '==', 'premium_unlock')
    );
    const unsubUnlocks = onSnapshot(qUnlocks, (snap) => {
      setRecentUnlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry)));
    });

    return () => {
      unsubSubs();
      unsubUnlocks();
    };
  }, [user]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-3xl font-headline font-bold">Access Dashboard</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to manage your unlocks, track earnings, and view active subscriptions.</p>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row items-center gap-8 pb-10 border-b border-white/10">
        <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-xl">
          <AvatarImage src={user?.avatar} />
          <AvatarFallback>{user?.username[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl font-headline font-bold mb-1 flex items-center justify-center md:justify-start gap-2">
            {user?.username}
            {user?.isCreator && <CheckCircle className="w-5 h-5 text-primary" />}
          </h1>
          <p className="text-muted-foreground mb-4">{user?.bio}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="bg-muted px-4 py-1.5 rounded-full text-xs font-mono border border-white/5">{user?.walletAddress.slice(0, 16)}...</div>
            <Button variant="outline" size="sm" onClick={disconnectWallet} className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-full px-4">
              <LogOut className="w-4 h-4" /> Disconnect
            </Button>
          </div>
        </div>
        <div className="flex gap-4">
          <Link href="/creator">
            <Button className="bg-primary hover:bg-primary/90 rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">Creator Panel</Button>
          </Link>
          <Link href="/wallet">
            <Button variant="secondary" className="rounded-2xl h-12 px-6">My Wallet</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" /> Available ULC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{user?.ulcBalance.available.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">Liquidity: High</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-400" /> Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{user?.totalEarnings.toFixed(2)} ULC</div>
            <p className="text-[10px] text-muted-foreground mt-1">From tokenized interactions</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-orange-400" /> Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{user?.totalSpent.toFixed(2)} ULC</div>
            <p className="text-[10px] text-muted-foreground mt-1">Premium unlocks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        <section className="space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400" /> Active Subscriptions
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {activeSubs.map((sub) => (
              <Card key={sub.id} className="glass-card border-white/10 hover:border-primary/30 transition-all">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={sub.creator.avatar} />
                    <AvatarFallback>{sub.creator.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-bold">{sub.creator.username}</p>
                    <p className="text-[10px] text-muted-foreground">Subscribed on {new Date(sub.timestamp).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/profile/${sub.creator.uid}`}>
                    <Button variant="ghost" size="sm">Visit</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
            {activeSubs.length === 0 && (
              <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center space-y-4">
                  <p className="text-muted-foreground text-sm">You haven't subscribed to any creators yet.</p>
                  <Link href="/">
                    <Button variant="outline" className="rounded-xl px-8 border-white/10">Explore Creators</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Premium Unlocks
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {recentUnlocks.map((unlock) => (
              <div key={unlock.id} className="flex items-center justify-between p-4 glass-card rounded-2xl border-white/5">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Content Unlock</span>
                  <span className="text-[10px] text-muted-foreground">Ref: {unlock.referenceId?.slice(0, 8)}...</span>
                </div>
                <div className="text-sm font-bold text-primary">-{unlock.amount} ULC</div>
              </div>
            ))}
            {recentUnlocks.length === 0 && (
              <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center text-muted-foreground text-sm">
                  Unlock premium content to see it listed here.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

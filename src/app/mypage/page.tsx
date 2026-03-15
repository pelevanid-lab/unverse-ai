
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Coins, Crown, ArrowUpRight, ArrowDownLeft, Sparkles, LogOut, CheckCircle, Gift, Bot } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CreatorProfile, LedgerEntry, Muse, UserProfile } from '@/lib/types';

const NON_GENDER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Favatar_nongender.png?alt=media&token=e2587329-3733-4dc3-8ab3-71b04510b503';

export default function MyPage() {
  const { user, isConnected, disconnectWallet, rawAddress } = useWallet();
  const [activeSubs, setActiveSubs] = useState<any[]>([]);
  const [recentUnlocks, setRecentUnlocks] = useState<LedgerEntry[]>([]);
  const [tipsHistory, setTipsHistory] = useState<LedgerEntry[]>([]);
  const [ownedMuses, setOwnedMuses] = useState<Muse[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);

  useEffect(() => {
    if (!user || !rawAddress) return;

    const addressFormats = Array.from(new Set([user.walletAddress, rawAddress]));

    // Fetch creator profile if user is a creator
    if (user.isCreator) {
      const creatorDocRef = doc(db, 'creators', user.uid);
      const unsubCreator = onSnapshot(creatorDocRef, (doc) => {
        if (doc.exists()) {
          setCreatorProfile(doc.data() as CreatorProfile);
        }
      });
      return () => unsubCreator();
    }

    // Fetch subscriptions
    const qSubs = query(
      collection(db, 'ledger'),
      where('fromWallet', 'in', addressFormats),
      where('type', '==', 'subscription_payment')
    );
    const unsubSubs = onSnapshot(qSubs, async (snap) => {
      const subs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        const creatorSnap = await getDoc(doc(db, 'users', data.referenceId));
        return { id: d.id, creator: creatorSnap.exists() ? creatorSnap.data() : null, ...data };
      }));
      setActiveSubs(subs.filter(s => s.creator));
    });

    // Fetch premium unlocks
    const qUnlocks = query(
      collection(db, 'ledger'),
      where('fromWallet', 'in', addressFormats),
      where('type', '==', 'premium_unlock')
    );
    const unsubUnlocks = onSnapshot(qUnlocks, (snap) => {
      setRecentUnlocks(snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry)));
    });

    // Fetch Tips (Sent & Received)
    const qTipsSent = query(collection(db, 'ledger'), where('fromWallet', 'in', addressFormats), where('type', '==', 'tip'));
    const qTipsReceived = query(collection(db, 'ledger'), where('toWallet', 'in', addressFormats), where('type', '==', 'tip'));

    const processTips = (snap: any) => {
        const data = snap.docs.map((d:any) => ({ id: d.id, ...d.data() } as LedgerEntry));
        setTipsHistory(prev => {
            const combined = [...prev, ...data].sort((a, b) => b.timestamp - a.timestamp);
            return Array.from(new Set(combined.map(t => t.id))).map(id => combined.find(t => t.id === id)!);
        });
    }
    const unsubTipsSent = onSnapshot(qTipsSent, processTips);
    const unsubTipsReceived = onSnapshot(qTipsReceived, processTips);

    // Fetch Owned Muses
    const qMuses = query(collection(db, 'muses'), where('ownerId', '==', user.uid));
    const unsubMuses = onSnapshot(qMuses, (snap) => {
        setOwnedMuses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Muse)));
    });

    return () => {
      unsubSubs();
      unsubUnlocks();
      unsubTipsSent();
      unsubTipsReceived();
      unsubMuses();
    };
  }, [user, rawAddress]);

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

  const displayName = creatorProfile?.displayName || user?.username;
  const avatar = creatorProfile?.avatar || user?.avatar || NON_GENDER_AVATAR;
  const bio = creatorProfile?.creatorBio || user?.bio;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row items-center gap-8 pb-10 border-b border-white/10">
        <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-xl">
          <AvatarImage src={avatar} className="object-cover"/>
          <AvatarFallback>{displayName?.[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl font-headline font-bold mb-1 flex items-center justify-center md:justify-start gap-2">
            {displayName}
            {user?.isCreator && <CheckCircle className="w-5 h-5 text-primary" />}
          </h1>
          <p className="text-muted-foreground mb-4">{bio}</p>
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
            {activeSubs.length > 0 ? (
              activeSubs.map((sub) => (
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
              ))
            ) : (
              <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center space-y-4">
                  <p className="text-muted-foreground text-sm">You haven't subscribed to any creators yet.</p>
                  <Link href="/discover">
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
            {recentUnlocks.length > 0 ? (
              recentUnlocks.map((unlock) => (
                <div key={unlock.id} className="flex items-center justify-between p-4 glass-card rounded-2xl border-white/5">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Content Unlock</span>
                    <span className="text-[10px] text-muted-foreground">Ref: {unlock.referenceId?.slice(0, 8)}...</span>
                  </div>
                  <div className="text-sm font-bold text-orange-400">-{unlock.amount} ULC</div>
                </div>
              ))
            ) : (
              <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center text-muted-foreground text-sm">
                  Unlock premium content to see it listed here.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* START of new sections */}
        <section className="space-y-6">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-pink-400" /> Tips History
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {tipsHistory.length > 0 ? (
              tipsHistory.map((tip) => {
                const isSent = tip.fromWallet.toLowerCase() === user.walletAddress;
                return (
                  <div key={tip.id} className="flex items-center justify-between p-4 glass-card rounded-2xl border-white/5">
                      <div className="flex items-center gap-3">
                        {isSent ? <ArrowUpRight className="w-5 h-5 text-orange-400"/> : <ArrowDownLeft className="w-5 h-5 text-green-400"/>}
                        <div className="flex flex-col">
                            <span className="text-sm font-bold">{isSent ? 'Tip Sent' : 'Tip Received'}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {isSent ? `To: ${tip.toWallet.slice(0,10)}` : `From: ${tip.fromWallet.slice(0,10)}`}...
                            </span>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${isSent ? 'text-orange-400' : 'text-green-400'}`}>
                        {isSent ? '-' : '+'}{tip.amount} ULC
                      </div>
                  </div>
                )
              })
            ) : (
              <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center text-muted-foreground text-sm">
                  You have no tip transaction history yet.
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="space-y-6">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                <Bot className="w-6 h-6 text-teal-400" /> Owned AI Muses
            </h2>
            <div className="grid grid-cols-2 gap-4">
                {ownedMuses.length > 0 ? (
                    ownedMuses.map((muse) => (
                        <Link key={muse.id} href={`/muses/${muse.id}/chat`} passHref>
                          <Card className="glass-card aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-primary/50 transition-colors h-full">
                              <Avatar className="w-16 h-16 mb-2">
                                  <AvatarImage src={muse.avatar} />
                                  <AvatarFallback>{muse.name[0]}</AvatarFallback>
                              </Avatar>
                              <p className="font-bold text-sm">{muse.name}</p>
                              <p className="text-xs text-muted-foreground">{muse.personality}</p>
                          </Card>
                        </Link>
                    ))
                ) : (
                    <div className="col-span-2">
                        <Card className="glass-card border-white/5 bg-white/[0.02]">
                            <CardContent className="p-12 text-center space-y-4">
                                <p className="text-muted-foreground text-sm">You don't own any Muses yet.</p>
                                <Link href="/muses">
                                    <Button variant="outline" className="rounded-xl px-8 border-white/10">Explore Muses</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </section>
        {/* END of new sections */}

      </div>
    </div>
  );
}

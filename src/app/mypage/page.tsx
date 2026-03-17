
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Coins, Crown, ArrowUpRight, ArrowDownLeft, Sparkles, LogOut, CheckCircle, Bot, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Creator, LedgerEntry } from '@/lib/types';

const NON_GENDER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Favatar_nongender.png?alt=media&token=e2587329-3733-4dc3-8ab3-71b04510b503';

export default function MyPage() {
  const { user, isConnected, disconnectWallet, rawAddress } = useWallet();
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [calculatedBalance, setCalculatedBalance] = useState<number | null>(null);
  const [calculatedEarnings, setCalculatedEarnings] = useState<number | null>(null);
  const [calculatedSpent, setCalculatedSpent] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !rawAddress) return;

    const addressFormats = Array.from(new Set([user.walletAddress.toLowerCase(), rawAddress.toLowerCase()]));
    const ledgerRef = collection(db, 'ledger');
    const entries = new Map<string, LedgerEntry>();
    let debounceTimer: NodeJS.Timeout;

    const processTransactions = () => {
      const allEntries = Array.from(entries.values());
      const totalIn = allEntries.filter(e => addressFormats.includes(e.toWallet.toLowerCase())).reduce((sum, e) => sum + e.amount, 0);
      const totalOut = allEntries.filter(e => addressFormats.includes(e.fromWallet.toLowerCase())).reduce((sum, e) => sum + e.amount, 0);
      const earnings = allEntries.filter(e => addressFormats.includes(e.toWallet.toLowerCase()) && ['creator_payout', 'tip', 'premium_unlock'].includes(e.type)).reduce((sum, e) => sum + e.amount, 0);
      
      setCalculatedBalance(totalIn - totalOut);
      setCalculatedEarnings(earnings);
      setCalculatedSpent(totalOut);
    };

    const listener = (querySnapshot: any) => {
      querySnapshot.forEach((doc: any) => { entries.set(doc.id, { id: doc.id, ...doc.data() }); });
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processTransactions, 200);
    };

    const qFrom = query(ledgerRef, where('fromWallet', 'in', addressFormats));
    const qTo = query(ledgerRef, where('toWallet', 'in', addressFormats));
    const unsubFrom = onSnapshot(qFrom, listener);
    const unsubTo = onSnapshot(qTo, listener);

    let unsubCreator: () => void = () => {};
    if (user.isCreator) {
      unsubCreator = onSnapshot(doc(db, 'creators', user.uid), (doc) => {
        if (doc.exists()) setCreatorProfile(doc.data() as Creator);
      });
    }

    return () => { unsubFrom(); unsubTo(); unsubCreator(); clearTimeout(debounceTimer); };
  }, [user, rawAddress]);


  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full"><Sparkles className="w-12 h-12 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold">Access Dashboard</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to manage your unlocks, track earnings, and view active subscriptions.</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button></Link>
      </div>
    );
  }

  const displayName = creatorProfile?.username || user?.username;
  const avatar = creatorProfile?.avatar || user?.avatar || NON_GENDER_AVATAR;
  const bio = creatorProfile?.bio || user?.bio;

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
          {user?.isCreator && <Link href="/creator"><Button className="bg-primary hover:bg-primary/90 rounded-2xl h-12 px-6 font-bold shadow-lg shadow-primary/20">Creator Panel</Button></Link>}
          <Link href="/wallet"><Button variant="secondary" className="rounded-2xl h-12 px-6">My Wallet</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Available ULC</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{calculatedBalance !== null ? calculatedBalance.toFixed(2) : '0.00'}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">Internal Balance</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-green-400" /> Total Earnings</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{calculatedEarnings !== null ? calculatedEarnings.toFixed(2) : '0.00'}</div>
            <p className="text-[10px] text-muted-foreground mt-1">From subscriptions, tips, and unlocks</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-orange-400" /> Total Spent</CardTitle></CardHeader>
          <CardContent>
            <div className="text-4xl font-headline font-bold">{calculatedSpent !== null ? calculatedSpent.toFixed(2) : '0.00'} ULC</div>
            <p className="text-[10px] text-muted-foreground mt-1">Premium unlocks and other fees</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-headline font-bold">My Content</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Link href="/my-unlocks" passHref>
                <Card className="glass-card border-white/10 hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <Sparkles className="w-6 h-6 text-primary" />
                            <p className="font-bold">Premium Unlocks</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>
             <Link href="/active-subs" passHref>
                <Card className="glass-card border-white/10 hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <Crown className="w-6 h-6 text-yellow-400" />
                            <p className="font-bold">Active Subscriptions</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>
             <Link href="/ai-muses" passHref>
                <Card className="glass-card border-white/10 hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <Bot className="w-6 h-6 text-teal-400" />
                            <p className="font-bold">Owned AI Muses</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </Link>
        </div>
      </div>
    </div>
  );
}

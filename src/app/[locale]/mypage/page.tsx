
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Coins, Crown, ArrowUpRight, ArrowDownLeft, Sparkles, LogOut, CheckCircle, Bot, ChevronRight, Wallet, Settings, Clock } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry } from '@/lib/types';
import { useTranslations } from 'next-intl';

const NON_GENDER_AVATAR = 'https://firebasestorage.googleapis.com/v0/b/unlonely-alpha.appspot.com/o/defaults%2Favatar_nongender.png?alt=media&token=e2587329-3733-4dc3-8ab3-71b04510b503';

export default function MyPage() {
  const t = useTranslations('MyPage');
  const { user, isConnected, disconnectWallet, rawAddress } = useWallet();
  const [calculatedEarnings, setCalculatedEarnings] = useState(0);
  const [calculatedSpent, setCalculatedSpent] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const ledgerRef = collection(db, 'ledger');

    // Safe listeners for earnings and spendings
    const qIn = query(ledgerRef, where('toUserId', '==', user.uid));
    const qOut = query(ledgerRef, where('fromUserId', '==', user.uid));

    const unsubIn = onSnapshot(qIn, (snap) => {
        const total = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        setCalculatedEarnings(total);
    });

    const unsubOut = onSnapshot(qOut, (snap) => {
        const total = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
        setCalculatedSpent(total);
    });

    return () => { unsubIn(); unsubOut(); };
  }, [user?.uid]);


  if (!isConnected || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full"><Sparkles className="w-12 h-12 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold">{t('dashboard')}</h1>
        <p className="text-muted-foreground max-w-sm">{t('dashboardDesc')}</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">{t('connectNow')}</Button></Link>
      </div>
    );
  }

  const displayName = user.username;
  const avatar = user.avatar || NON_GENDER_AVATAR;
  const bio = user.bio;
  const availableULC = user.ulcBalance?.available || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 px-4 mt-6">
      <div className="flex flex-col md:flex-row items-center gap-8 pb-10 border-b border-white/10"> 
        <div className="relative">
            <Avatar className="w-40 h-40 border-4 border-primary/20 shadow-2xl">
                <AvatarImage src={avatar} className="object-cover"/>
                <AvatarFallback className="text-4xl">{displayName?.[0]}</AvatarFallback>
            </Avatar>
            {user.isCreator && <div className="absolute -bottom-2 -right-2 bg-primary p-2 rounded-full border-4 border-background"><Crown className="w-5 h-5 text-white" /></div>}
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-5xl font-headline font-bold mb-2 flex items-center justify-center md:justify-start gap-3">
            {displayName}
            {user.isCreator && <CheckCircle className="w-6 h-6 text-primary" />}
          </h1>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl">{bio}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-mono border border-white/10 text-muted-foreground">
                {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-8)}
            </div>
            <Button variant="ghost" size="sm" onClick={disconnectWallet} className="gap-2 text-destructive hover:bg-destructive/10 rounded-full px-4">
              <LogOut className="w-4 h-4" /> {t('disconnect')}
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full md:w-auto">
          {user.isCreator ? (
             <Link href="/creator"><Button className="w-full bg-primary hover:bg-primary/90 rounded-2xl h-14 px-8 font-bold shadow-xl shadow-primary/20 text-lg">{t('creatorPanel')}</Button></Link>
          ) : (
             <Link href="/creator"><Button variant="outline" className="w-full rounded-2xl h-14 px-8 border-primary/30 text-primary hover:bg-primary/5">{t('becomeCreator')}</Button></Link>
          )}
          <Link href="/wallet"><Button variant="secondary" className="w-full rounded-2xl h-14 px-8 font-bold">{t('myWallet')}</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> {t('availableBalance')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-headline font-bold tracking-tighter">{availableULC.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest opacity-60">{t('unlockCurrencyInfo')}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-green-400" /> {t('totalEarnings')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-headline font-bold tracking-tighter">{calculatedEarnings.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest opacity-60">{t('lifetimeEarningsInfo')}</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-orange-400" /> {t('totalSpent')}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-headline font-bold tracking-tighter">{calculatedSpent.toFixed(2)}</div>
            <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest opacity-60">{t('unlocksSubsInfo')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 pt-6">
        <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> {t('management')}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <Link href="/my-unlocks" className="group">
                <Card className="glass-card border-white/10 group-hover:border-primary/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors"><Sparkles className="w-6 h-6 text-primary" /></div>
                            <div>
                                <p className="font-bold">{t('premiumUnlocks')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('ownedContent')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                </Card>
            </Link>

            <Link href="/limited-editions" className="group">
                <Card className="glass-card border-white/10 group-hover:border-yellow-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:bg-yellow-500/20 transition-colors"><Clock className="w-6 h-6 text-yellow-400" /></div>
                            <div>
                                <p className="font-bold">{t('limitedEditions')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('restrictedSupply')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>

             <Link href="/active-subs" className="group">
                <Card className="glass-card border-white/10 group-hover:border-yellow-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:bg-yellow-500/20 transition-colors"><Crown className="w-6 h-6 text-yellow-400" /></div>
                            <div>
                                <p className="font-bold">{t('subscriptions')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('activeAccess')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>

            <Link href="/payment-wallets" className="group">
                <Card className="glass-card border-white/10 group-hover:border-blue-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors"><Wallet className="w-6 h-6 text-blue-400" /></div>
                            <div>
                                <p className="font-bold">{t('paymentWallets')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('connection')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>
        </div>
      </div>
    </div>
  );
}

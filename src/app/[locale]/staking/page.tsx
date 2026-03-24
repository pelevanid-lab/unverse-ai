"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, Lock, Unlock, TrendingUp, ShieldCheck, Sparkles, Loader2, ArrowRight, Milestone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { handleStaking, handleUnstaking } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function StakingPage() {
  const t = useTranslations('Staking');
  const { user, isConnected } = useWallet();
  const [config, setConfig] = useState<any>(null);
  const [amount, setAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'system'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => unsub();
  }, []);

  const handleStake = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await handleStaking(user, parseFloat(amount));
      toast({ title: t('stakeButton'), description: `${amount} ULC moved to staking.` });
      setAmount('0');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Staking Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleUnstake = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await handleUnstaking(user, parseFloat(amount));
      toast({ title: t('unstakeButton'), description: `${amount} ULC returned to available.` });
      setAmount('0');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Unstaking Failed", description: e.message });
    }
    setLoading(false);
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <TrendingUp className="w-16 h-16 text-primary" />
      <h1 className="text-3xl font-headline font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('connectToEarn')}</p>
    </div>
  );

  const stakedBalance = user?.ulcBalance?.staked || 0;
  const availableBalance = user?.ulcBalance?.available || 0;
  const totalPoolULC = (config?.totalBuybackStakingUSDC || 0) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 relative group">
      {/* Mainnet Activation Overlay */}
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 text-center p-6 sm:p-12 mb-12">
          <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <Lock className="w-12 h-12 text-primary animate-pulse" />
          </div>
          <h2 className="text-3xl md:text-5xl font-headline font-bold text-white max-w-2xl mb-8 leading-[1.1] tracking-tight">
              THIS FEATURE WILL BE ACTIVATED WITH THE MAINNET LAUNCH.
          </h2>
          <div className="inline-flex items-center px-8 py-3 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-sm tracking-[0.2em] uppercase backdrop-blur-xl shadow-lg shadow-primary/10 mb-8">
              Coming with Mainnet
          </div>
          <Link href="/community#roadmap" className="group/btn relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-full blur opacity-25 group-hover/btn:opacity-100 transition duration-1000 group-hover/btn:duration-200"></div>
              <Button variant="outline" className="relative h-12 rounded-full border-primary/50 text-white font-bold px-8 gap-3 bg-black hover:bg-zinc-900 transition-all">
                  <Milestone className="w-4 h-4 text-primary" />
                  VIEW MAINNET ROADMAP
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
          </Link>
      </div>

      <div className="opacity-20 pointer-events-none grayscale blur-sm">
        <header className="text-center md:text-left">
          <h1 className="text-5xl font-headline font-bold gradient-text">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
        </header>
  
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-primary">{t('yourStaked')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-headline">{stakedBalance.toLocaleString()} ULC</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('globalPool')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-headline text-green-400">~{totalPoolULC.toLocaleString()} ULC</div>
              <p className="text-[10px] opacity-70">{t('accumulated')}</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('totalStaked')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-headline">{(config?.totalStakedULC || 0).toLocaleString()} ULC</div>
            </CardContent>
          </Card>
        </div>
  
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> {t('stakeTokens')}
              </CardTitle>
              <CardDescription>{t('lockDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                  <span>{t('amountToStake')}</span>
                  <span>{t('max')}: {availableBalance.toFixed(2)}</span>
                </div>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="bg-muted border-none h-14 text-xl font-bold"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 text-[10px]"
                    onClick={() => setAmount(availableBalance.toString())}
                  >
                    {t('max')}
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-muted/20 rounded-xl space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('lockPeriod')}</span>
                  <span className="font-bold">{t('liquidStaking')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('estWeekly')}</span>
                  <span className="font-bold">{(parseFloat(amount || '0') * 0.124 / 52).toFixed(4)} ULC</span>
                </div>
              </div>
  
              <Button onClick={handleStake} disabled={true} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold gap-2">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                {t('stakeButton')}
              </Button>
            </CardContent>
          </Card>
  
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-primary" /> {t('unstakeTokens')}
              </CardTitle>
              <CardDescription>{t('unstakeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                  <span>{t('amountToUnstake')}</span>
                  <span>{t('max')}: {stakedBalance.toFixed(2)}</span>
                </div>
                <div className="relative">
                  <Input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    className="bg-muted border-none h-14 text-xl font-bold"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 text-[10px]"
                    onClick={() => setAmount(stakedBalance.toString())}
                  >
                    {t('max')}
                  </Button>
                </div>
              </div>
  
              <div className="p-4 bg-muted/20 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-yellow-400 mt-1" />
                <div className="space-y-1">
                  <p className="text-xs font-bold">{t('unstakeNotice')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('instantNotice')}</p>
                </div>
              </div>
  
              <Button onClick={handleUnstake} variant="outline" disabled={true} className="w-full h-14 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                {t('unstakeButton')}
              </Button>
            </CardContent>
          </Card>
        </div>
  
        <section className="space-y-6">
          <h2 className="text-2xl font-headline font-bold">{t('statistics')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card p-6">
              <h4 className="text-sm font-bold text-muted-foreground mb-4 uppercase">{t('distribution')}</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>{t('communityStakers')}</span>
                    <span>84%</span>
                  </div>
                  <Progress value={84} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>{t('foundationReserve')}</span>
                    <span>16%</span>
                  </div>
                  <Progress value={16} />
                </div>
              </div>
            </Card>
            <Card className="glass-card p-6 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground text-center">
                {t('rewardInfo')}
              </p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

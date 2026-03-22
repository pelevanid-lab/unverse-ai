
"use client"

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { AnimatedText } from '@/components/landing/AnimatedText';
import { 
    ArrowRight, Zap, Coins, Flame, Gem, TrendingUp, 
    Lock, Shield, BarChart3, ChevronRight, Info,
    DollarSign, Loader2, ArrowRightLeft, Database, Sparkles,
    Link as LinkIcon, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { 
    getSystemConfig, 
    confirmPresalePurchaseAction,
    calculateProtocolFloorPrice
} from '@/lib/ledger';
import { SystemConfig } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { 
    getPresaleStageInfo, 
    calculateUlcForUsdt, 
    PRESALE_TOTAL_ALLOCATION 
} from '@/lib/presale';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TokenomicsPage() {
  const t = useTranslations('Tokenomics');
  const { isConnected, connectWallet, user } = useWallet();
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  
  // Presale States
  const [usdtAmount, setUsdtAmount] = useState(10);
  const [ulcAmount, setUlcAmount] = useState(1111); // Initial based on ~$0.009
  const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');
  const [isProcessing, setIsProcessing] = useState(false);

  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    getSystemConfig().then(setSystemConfig);
    
    // Live Stats for for for floor price
    const unsubStats = onSnapshot(doc(db, 'config', 'stats'), (snap) => {
        if (snap.exists()) setStats(snap.data());
    });

    return () => unsubStats();
  }, []);

  const presaleSold = systemConfig?.totalPresaleSold || 0;
  const stageInfo = getPresaleStageInfo(presaleSold);

  const handleUsdtChange = (val: string) => {
    const num = Number(val);
    setUsdtAmount(num);
    const { totalUlc } = calculateUlcForUsdt(presaleSold, num);
    setUlcAmount(totalUlc);
  };

  const handlePurchase = async () => {
    if (!user || !systemConfig) {
        toast({ variant: "destructive", title: t('authRequired'), description: t('authRequiredDesc') });
        return;
    }

    const treasuryWallet = systemConfig.treasury_wallets[selectedNetwork];
    setIsProcessing(true);

    try {
        let txHash: string;
        if (selectedNetwork === 'TON') {
            if (!tonConnectUI.connected) await tonConnectUI.openModal();
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{ address: treasuryWallet, amount: (usdtAmount * 1_000_000_000).toString() }]
            });
            txHash = result.boc;
        } else {
            const provider = (window as any).tronWeb;
            if (!provider) throw new Error("TronLink not found.");
            const contract = await provider.contract().at("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
            const result = await contract.transfer(treasuryWallet, (usdtAmount * 1_000_000).toString()).send();
            txHash = result;
        }

        await confirmPresalePurchaseAction(user, usdtAmount, selectedNetwork, txHash);
        toast({ title: t('successTitle'), description: t('successDesc', { amount: ulcAmount.toLocaleString() }) });
        getSystemConfig().then(setSystemConfig);
    } catch (e: any) {
        toast({ variant: "destructive", title: t('purchaseFailed'), description: e.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const presaleProgress = (presaleSold / PRESALE_TOTAL_ALLOCATION) * 100;

  return (
    <div className="space-y-16 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-10 md:pt-20 text-center space-y-8 max-w-5xl mx-auto px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-primary/10 blur-[150px] rounded-full -z-10" />
        
        <h1 className="text-6xl md:text-8xl font-headline font-bold tracking-tighter leading-[0.9]">
            {t('title1')} <br/>
            <span className="gradient-text">{t('title2')}</span>
        </h1>
        
        <div className="text-3xl md:text-5xl font-headline font-bold leading-tight">
            <AnimatedText words={[t('heroWord1'), t('heroWord2'), t('heroWord3')]} />
        </div>
        
        <p className="text-xs md:text-sm text-primary/60 font-bold tracking-[0.3em] uppercase">
            {t('subtitle')}
        </p>

        {/* Pre-Sale Card */}
        <div className="mt-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Card className={`glass-card border-primary/30 relative overflow-hidden group shadow-2xl shadow-primary/10 ${stageInfo.isSoldOut ? 'opacity-70 grayscale' : ''}`}>
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                    <Badge variant="outline" className="text-primary border-primary/20 backdrop-blur-md">
                        Stage {stageInfo.currentStage}/5
                    </Badge>
                    <Badge className={`${stageInfo.isSoldOut ? 'bg-red-500' : 'bg-green-500'} text-black font-bold animate-pulse`}>
                        {stageInfo.isSoldOut ? 'SOLD OUT' : t('presaleBadge')}
                    </Badge>
                </div>
                
                <CardHeader className="text-left pb-2">
                    <CardTitle className="text-2xl font-headline font-bold text-yellow-500 flex items-center gap-2">
                        <Zap className="fill-yellow-500" /> {t('presaleTitle')}
                    </CardTitle>
                    <CardDescription>{t('presaleDesc')}</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6 text-left">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50" />
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('priceLabel')}</p>
                            <p className="text-xl font-bold font-headline text-green-400">${stageInfo.currentPrice.toFixed(3)} <span className="text-xs font-normal opacity-50">USDT</span></p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('listingLabel')}</p>
                            <p className="text-xl font-bold font-headline text-primary">${systemConfig?.listingPriceUSDT || 0.015} <span className="text-xs font-normal opacity-50">USDT</span></p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-muted-foreground uppercase">{t('soldLabel')}: {presaleSold.toLocaleString()} / 100M</Label>
                                {!stageInfo.isSoldOut && (
                                    <p className="text-[10px] text-primary/70 font-bold">
                                        {stageInfo.remainingInStage.toLocaleString()} ULC remaining at this price
                                    </p>
                                )}
                            </div>
                            <span className="text-xs font-bold text-primary">{presaleProgress.toFixed(1)}%</span>
                        </div>
                        <Progress value={presaleProgress} className="h-2 bg-white/5" />
                        
                        {stageInfo.nextPrice && (
                            <p className="text-[10px] text-center text-muted-foreground opacity-60">
                                Next Stage Price: <span className="text-white font-bold">${stageInfo.nextPrice.toFixed(3)}</span>
                            </p>
                        )}
                    </div>

                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold">{t('investAmount')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={usdtAmount}
                                        onChange={(e) => handleUsdtChange(e.target.value)}
                                        disabled={stageInfo.isSoldOut}
                                        className="h-12 bg-white/5 border-white/10 font-bold pl-12"
                                    />
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-primary/70">{t('receiveAmount')}</p>
                                <p className="text-lg font-bold font-headline">{Math.floor(ulcAmount).toLocaleString()} ULC</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4">
                                <div className="flex items-center space-x-2 bg-white/5 px-4 h-11 rounded-xl border border-white/5 cursor-pointer">
                                    <RadioGroupItem value="TON" id="p-ton" />
                                    <Label htmlFor="p-ton" className="cursor-pointer font-bold">TON</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 px-4 h-11 rounded-xl border border-white/5 cursor-pointer">
                                    <RadioGroupItem value="TRON" id="p-tron" />
                                    <Label htmlFor="p-tron" className="cursor-pointer font-bold">TRON</Label>
                                </div>
                            </RadioGroup>
                            
                            <Button 
                                onClick={handlePurchase} 
                                disabled={isProcessing || !isConnected}
                                className="flex-1 h-12 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" /> : t('purchaseButton')}
                            </Button>
                        </div>
                        
                        {/* Base Network Notice Card */}
                        <div className="mt-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-4 items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                <LinkIcon className="text-blue-400 w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-blue-400 leading-none">{t('baseNoticeTitle')}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    {t('baseNoticeDesc')}
                                </p>
                            </div>
                        </div>

                        <p className="text-[10px] text-center text-muted-foreground italic">
                            {t('vestingHint', { learnMore: t('learnMore') })}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Dynamic Floor Price Tracking */}
        {systemConfig?.isSealed && (
            <div className="mt-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                <Card className="glass-card border-blue-500/30 overflow-hidden relative shadow-2xl shadow-blue-500/10">
                    <div className="absolute top-0 right-0 p-4">
                        <Badge className="bg-blue-500 text-black font-bold animate-pulse">
                            {t('militaryPrice')}
                        </Badge>
                    </div>
                    
                    <CardHeader className="text-left pb-2">
                        <CardTitle className="text-2xl font-headline font-bold text-blue-400 flex items-center gap-2">
                            <Shield className="fill-blue-400" /> {t('dynamicFloorPrice')}
                        </CardTitle>
                        <CardDescription>
                            {t('buybackMechanism')}
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-6 text-left">
                        <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex flex-col items-center justify-center text-center space-y-2">
                            <p className="text-xs font-bold text-blue-400/70 uppercase tracking-widest">{t('militaryPrice')}</p>
                            <h3 className="text-5xl font-headline font-bold text-blue-400">
                                ${calculateProtocolFloorPrice(systemConfig, stats?.totalBurnedULC || 0).toFixed(6)}
                            </h3>
                            <p className="text-[10px] text-muted-foreground opacity-60">
                                {t('targetCapLabel')}: $15,000,000 USD
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('remainingSupplyLabel')}</p>
                                <p className="text-lg font-bold font-headline text-primary">
                                    {( (systemConfig.initialSupplyAtSeal || 1000000000) - (stats?.totalBurnedULC || 0) ).toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('deflationTitle')}</p>
                                <p className="text-lg font-bold font-headline text-red-500">
                                    {(stats?.totalBurnedULC || 0).toLocaleString()} <span className="text-[10px]">BURNED</span>
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-4 items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                <ShieldAlert className="text-blue-400 w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-blue-400 leading-none">{t('buybackMechanism')}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    {t('buybackNote')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
      </section>

      {/* Guide Links Section */}
      <section className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/tokenomics/investors">
            <Card className="glass-card p-8 border-yellow-500/20 hover:border-yellow-500/50 transition-all group overflow-hidden relative">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-32 h-32 text-yellow-500" />
                </div>
                <div className="space-y-4 relative z-10">
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">{t('institutionalBadge')}</Badge>
                    <h3 className="text-3xl font-headline font-bold">{t('investorTitle')}</h3>
                    <p className="text-muted-foreground text-sm">{t('investorDesc')}</p>
                    <div className="flex items-center gap-2 text-yellow-500 font-bold pt-2 group-hover:translate-x-1 transition-transform">
                        {t('readWhitepaper')} <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Card>
          </Link>

          <Link href="/tokenomics/creators">
            <Card className="glass-card p-8 border-pink-500/20 hover:border-pink-500/50 transition-all group overflow-hidden relative">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-32 h-32 text-pink-500" />
                </div>
                <div className="space-y-4 relative z-10">
                    <Badge variant="outline" className="text-pink-400 border-pink-500/20">{t('creatorBadge')}</Badge>
                    <h3 className="text-3xl font-headline font-bold">{t('creatorTitle')}</h3>
                    <p className="text-muted-foreground text-sm">{t('creatorDesc')}</p>
                    <div className="flex items-center gap-2 text-pink-400 font-bold pt-2 group-hover:translate-x-1 transition-transform">
                        {t('startEarning')} <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Card>
          </Link>
      </section>

      {/* Striking Data Section */}
      <section className="max-w-5xl mx-auto px-4 py-10 space-y-12">
          <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-headline font-bold">{t('sustainabilityTitle')}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('sustainabilitySubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                  { 
                      icon: <Flame className="text-red-400" />, 
                      title: t('deflationTitle'), 
                      desc: t('deflationDesc'),
                      color: "border-red-500/20"
                  },
                  { 
                      icon: <Gem className="text-green-400" />, 
                      title: t('yieldTitle'), 
                      desc: t('yieldDesc'),
                      color: "border-green-500/20"
                  },
                  { 
                      icon: <Coins className="text-blue-400" />, 
                      title: t('fairSplitTitle'), 
                      desc: t('fairSplitDesc'),
                      color: "border-blue-500/20"
                  }
              ].map((item, idx) => (
                  <Card key={idx} className={`glass-card p-6 space-y-4 ${item.color}`}>
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                          {item.icon}
                      </div>
                      <h4 className="text-xl font-headline font-bold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </Card>
              ))}
          </div>

          <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-white/5 flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 blur-3xl opacity-50" />
              <div className="space-y-4 relative z-10">
                  <h3 className="text-3xl font-headline font-bold">{t('capTitle1')} <br/> <span className="opacity-50">{t('capTitle2')}</span></h3>
                  <p className="text-muted-foreground max-w-sm">{t('capDesc')}</p>
                  <Link href="/tokenomics/investors">
                    <Button variant="link" className="p-0 h-auto text-primary gap-2">
                        {t('auditLink')} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
              </div>
              <div className="flex gap-4 relative z-10 scale-90 sm:scale-100">
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <Lock className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">{t('security')}</p>
                      <p className="font-bold">{t('sealed')}</p>
                  </Card>
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <Shield className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">{t('audit')}</p>
                      <p className="font-bold">{t('verified')}</p>
                  </Card>
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <BarChart3 className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">{t('supply')}</p>
                      <p className="font-bold">{t('capped')}</p>
                  </Card>
              </div>
          </div>
      </section>
    </div>
  );
}

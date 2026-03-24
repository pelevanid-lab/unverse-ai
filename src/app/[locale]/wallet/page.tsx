"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, VestingSchedule } from '@/lib/types';
import { confirmUlcPurchase, createClaimRequest, getSystemConfig, calculateCreatorUsdtEarnings, getVestingSchedules, claimVestedULCAction, calculateProtocolFloorPrice } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Wallet as WalletIcon, History, ExternalLink, Settings, ArrowRightLeft, ChevronLeft, Sparkles, ShieldCheck } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

// --- CONSTANTS ---
// ULC_PRICE_USDT is now dynamic

// --- SUB-COMPONENTS ---

function BalanceCard({ user, onShowVesting }: { user: UserProfile | null, onShowVesting?: () => void }) {
    const t = useTranslations('Wallet');
    let numericBalance = 0;
    const ulcBalance = user?.ulcBalance;

    if (typeof ulcBalance === 'number') {
        numericBalance = ulcBalance;
    } else if (typeof ulcBalance === 'object' && ulcBalance !== null && 'available' in ulcBalance) {
        const availableBalance = (ulcBalance as any).available;
        if (typeof availableBalance === 'number') {
            numericBalance = availableBalance;
        }
    }

    const displayBalance = isNaN(numericBalance) ? '0.00' : numericBalance.toFixed(2);
    const lockedBalance = user?.ulcBalance?.locked || 0;

    return (
        <Card className="glass-card lg:col-span-12 relative overflow-hidden group border-white/5">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('yourBalance')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold font-headline gradient-text">{displayBalance}</span>
                            <span className="text-xl font-medium text-muted-foreground">ULC</span>
                        </div>
                        <p className="text-xs text-primary/60 font-medium">{t('availableToSpend')}</p>
                    </div>
                    {lockedBalance > 0 && (
                        <div 
                            className="flex items-center gap-4 bg-orange-500/5 border border-orange-500/10 p-4 rounded-2xl cursor-pointer hover:bg-orange-500/10 transition-all active:scale-95 group/locked"
                            onClick={onShowVesting}
                        >
                             <div className="space-y-0.5">
                                <p className="text-[10px] text-orange-400/70 font-bold uppercase tracking-tighter flex items-center gap-1">
                                    {t('lockedAssets')}
                                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/locked:opacity-100 transition-opacity" />
                                </p>
                                <div className="text-2xl font-bold text-orange-400">{lockedBalance.toFixed(1)} <span className="text-xs font-normal opacity-70">ULC</span></div>
                             </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function VestingDashboard({ schedules, onClaim, loading }: { schedules: VestingSchedule[], onClaim: (id: string) => void, loading: string | null }) {
    const t = useTranslations('Wallet');
    if (schedules.length === 0) return null;

    return (
        <Card className="glass-card lg:col-span-12 border-blue-500/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                        <Sparkles className="w-5 h-5 text-blue-400" />
                    </div>
                    {t('vestingSchedules')}
                </CardTitle>
                <CardDescription>{t('vestingDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schedules.map(s => {
                    const now = Date.now();
                    const timePassed = now - s.startTime;
                    const progress = Math.min(100, (timePassed / s.duration) * 100);
                    const isCliff = now < s.startTime + s.cliff;
                    
                    const vestedToDate = s.totalAmount * (Math.min(1, timePassed / s.duration));
                    const claimable = Math.max(0, vestedToDate - s.releasedAmount);

                    return (
                        <div key={s.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative group hover:border-blue-500/30 transition-all">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-base">{s.description || 'System Vesting'}</h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">Total: <span className="text-blue-400 font-mono">{s.totalAmount}</span> ULC</p>
                                </div>
                                <Badge variant={isCliff ? "outline" : "secondary"} className={isCliff ? "border-orange-500/30 text-orange-400 text-[10px]" : "bg-blue-500/20 text-blue-400 text-[10px]"}>
                                    {isCliff ? t('inCliff') : `${progress.toFixed(0)}% ${t('vested')}`}
                                </Badge>
                            </div>
                            
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-medium text-muted-foreground uppercase opacity-70">
                                    <span>{t('progress')}</span>
                                    <span>{progress.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5 p-0.5">
                                    <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold opacity-50">{t('released')}</p>
                                    <p className="text-sm font-bold font-mono">{s.releasedAmount.toFixed(1)} / {s.totalAmount}</p>
                                </div>
                                <Button 
                                    size="sm" 
                                    disabled={!!loading || claimable < 1 || isCliff}
                                    onClick={() => onClaim(s.id)}
                                    className="h-10 px-4 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
                                >
                                    {loading === s.id ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                                    {t('claimVested', { amount: claimable.toFixed(1) })}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function HistoryCardLink() {
    const t = useTranslations('Wallet');
    return (
        <Link href="/wallet/history">
            <Card className="glass-card lg:col-span-5 border-white/10 hover:border-primary/50 transition-colors cursor-pointer mt-4">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><History/> {t('transactionHistory')}</span>
                        <ExternalLink className="w-5 h-5 text-muted-foreground"/>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">{t('viewHistoryDesc')}</p>
                </CardContent>
            </Card>
        </Link>
    )
}

function BuyUlcCard({ user, systemConfig, onPurchase }: { user: UserProfile, systemConfig: SystemConfig | null, onPurchase: (ulcAmount: number, network: 'TRON' | 'TON', usdtCost: number) => Promise<void> }) {
    const t = useTranslations('Wallet');
    const [ulcAmount, setUlcAmount] = useState<number>(1000);
    const [usdtAmount, setUsdtAmount] = useState<number>(15);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');
    const [isProcessing, setIsProcessing] = useState(false);
    const [stats, setStats] = useState<any>(null);

    // Live Stats for for for floor price
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'config', 'stats'), (snap) => {
            if (snap.exists()) setStats(snap.data());
        });
        return () => unsub();
    }, []);

    const currentPrice = systemConfig?.isSealed 
        ? calculateProtocolFloorPrice(systemConfig, stats?.totalBurnedULC || 0)
        : (systemConfig?.listingPriceUSDT || 0.015);

    // First Purchase Bonus Logic
    const isFirstPurchase = !user?.firstPurchaseBonusClaimed;
    const bonusAmount = isFirstPurchase ? Math.floor(Math.min(ulcAmount * 0.5, 85)) : 0;
    const totalWithBonus = ulcAmount + bonusAmount;

    // Sync amounts
    const handleUlcChange = (val: string) => {
        const num = Math.max(0, Number(val));
        setUlcAmount(num);
        setUsdtAmount(Number((num * currentPrice).toFixed(4)));
    };

    const handleUsdtChange = (val: string) => {
        const num = Math.max(0, Number(val));
        setUsdtAmount(num);
        setUlcAmount(Number((num / currentPrice).toFixed(0)));
    };

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            await onPurchase(ulcAmount, selectedNetwork, usdtAmount);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="glass-card lg:col-span-12 relative overflow-hidden group border-white/5">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:bg-primary/10 transition-colors" />
            
            <Link href="/payment-wallets" className="absolute top-6 right-6 z-10">
                <Button variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 gap-2 px-4 h-10 border border-white/5" title={t('paymentWallets')}>
                    <Settings className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">{t('paymentWallets')}</span>
                </Button>
            </Link>

            <CardHeader className="pb-8">
                <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-2xl font-bold font-headline">{t('buyUlc')}</CardTitle>
                    {isFirstPurchase && (
                        <Badge className="bg-gradient-to-r from-primary/80 to-primary text-white border-none px-3 py-1 shadow-lg shadow-primary/20 animate-pulse">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {t('firstPurchaseBonus')}
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-base">
                    {t('buyUlcDesc')}
                    {isFirstPurchase && (
                        <span className="block mt-2 text-primary font-medium flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            {t('bonusDescription')}
                        </span>
                    )}
                </CardDescription>

                {/* Price Feed Indicator */}
                <div className="mt-4 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between group/price">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{t('militaryPrice')}</span>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold font-headline text-blue-400">${currentPrice.toFixed(6)}</p>
                        <p className="text-[9px] opacity-50 uppercase font-bold">{t('dynamicFloorPrice')}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center bg-white/5 p-6 rounded-3xl border border-white/5">
                    <div className="md:col-span-5 space-y-3">
                        <Label className="text-xs font-bold text-muted-foreground uppercase opacity-70 tracking-tighter">{t('ulcAmount')}</Label>
                        <div className="relative group">
                            <Input
                                type="number"
                                value={ulcAmount}
                                onChange={(e) => handleUlcChange(e.target.value)}
                                className="h-16 text-3xl font-bold pl-16 bg-black/20 border-white/10 focus:border-primary/50 transition-all rounded-2xl"
                                min="1"
                            />
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/40 font-black text-xl select-none group-focus-within:text-primary transition-colors">ULC</div>
                        </div>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-center pt-6">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shadow-inner">
                            <ArrowRightLeft className="text-muted-foreground w-4 h-4 rotate-90 md:rotate-0 opacity-50" />
                        </div>
                    </div>

                    <div className="md:col-span-5 space-y-3">
                        <Label className="text-xs font-bold text-muted-foreground uppercase opacity-70 tracking-tighter">{t('usdtCost')}</Label>
                        <div className="relative group">
                            <Input
                                type="number"
                                value={usdtAmount}
                                onChange={(e) => handleUsdtChange(e.target.value)}
                                className="h-16 text-3xl font-bold pl-20 bg-black/20 border-white/10 focus:border-primary/50 transition-all rounded-2xl"
                                min="0.01"
                            />
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-green-500/40 font-black text-xl select-none group-focus-within:text-green-500 transition-colors">USDT</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-sm font-bold uppercase tracking-widest text-muted-foreground opacity-50">{t('selectNetwork')}</Label>
                    <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="grid grid-cols-2 gap-4">
                        <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl border transition-all cursor-pointer ${selectedNetwork === 'TON' ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' : 'bg-white/5 border-white/5 hover:bg-white/10'}`} onClick={() => setSelectedNetwork('TON')}>
                            <RadioGroupItem value="TON" id="ton" className="border-primary text-primary" />
                            <div className="flex flex-col">
                                <Label htmlFor="ton" className="cursor-pointer font-bold text-lg">TON</Label>
                                <span className="text-[10px] uppercase font-bold opacity-40">Native Jetton</span>
                            </div>
                        </div>
                        <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl border transition-all cursor-pointer ${selectedNetwork === 'TRON' ? 'bg-primary/10 border-primary shadow-lg shadow-primary/5' : 'bg-white/5 border-white/5 hover:bg-white/10'}`} onClick={() => setSelectedNetwork('TRON')}>
                            <RadioGroupItem value="TRON" id="tron" className="border-primary text-primary" />
                            <div className="flex flex-col">
                                <Label htmlFor="tron" className="cursor-pointer font-bold text-lg">TRON</Label>
                                <span className="text-[10px] uppercase font-bold opacity-40">USDT-TRC20</span>
                            </div>
                        </div>
                    </RadioGroup>
                </div>

                <Button 
                    onClick={handlePurchase} 
                    disabled={isProcessing || !user || !systemConfig || usdtAmount <= 0} 
                    className="w-full h-16 text-xl font-bold shadow-xl shadow-primary/20 bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-2xl group"
                >
                    {isProcessing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <DollarSign className="w-6 h-6" />
                            {isFirstPurchase ? (
                                <span>{t('payButton', { usdt: usdtAmount, ulc: totalWithBonus })} <span className="text-sm font-normal opacity-70">({ulcAmount} + {bonusAmount} Bonus)</span></span>
                            ) : (
                                <span>{t('payButton', { usdt: usdtAmount, ulc: ulcAmount })}</span>
                            )}
                        </div>
                    )}
                </Button>
                
                <p className="text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-30">
                    Secure on-chain transaction • Instant delivery
                </p>
            </CardContent>
        </Card>
    );
}

function UsdtEarningsCard({ creator, onClaim, loading, availableBalance, pendingBalance }: { creator: Creator, onClaim: () => void, loading: boolean, availableBalance: number, pendingBalance: number }) {
    const t = useTranslations('Wallet');
    return (
        <Card className="glass-card lg:col-span-5 relative border-white/10">
            <Link href="/creator/collection-wallets" className="absolute top-4 right-4 z-10">
                <Button variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 gap-2 px-2 sm:px-4 h-9" title={t('collectionAddresses')}>
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-medium">{t('collectionAddresses')}</span>
                </Button>
            </Link>
            <CardHeader>
                <CardTitle>{t('usdtEarnings')}</CardTitle>
                <CardDescription>{t('usdtEarningsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                 <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t('availableToClaim')}</p>
                    <p className="text-2xl font-bold font-headline">{availableBalance.toFixed(2)} <span className="text-base font-normal text-muted-foreground">USDT</span></p>
                </div>
                <div className="space-y-1">
                     <p className="text-sm text-muted-foreground">{t('pendingClaim')}</p>
                    <p className="text-2xl font-bold font-headline">{pendingBalance.toFixed(2)} <span className="text-base font-normal text-muted-foreground">USDT</span></p>
                </div>
                 <Button onClick={onClaim} disabled={loading || availableBalance <= 0} className="w-full md:w-auto">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <WalletIcon className="w-4 h-4 mr-2" />}
                    {t('claimFunds')}
                </Button>
            </CardContent>
        </Card>
    );
}


// --- MAIN WALLET PAGE ---
export default function WalletPage() {
  const t = useTranslations('Wallet');
  const router = useRouter();
  const { user, isConnected } = useWallet();
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [vestingLoading, setVestingLoading] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ available: number, pending: number }>({ available: 0, pending: 0 });
  const [schedules, setSchedules] = useState<VestingSchedule[]>([]);
  const [showVestingModal, setShowVestingModal] = useState(false);

  // Fetch user profile and system config
  useEffect(() => {
    getSystemConfig().then(setSystemConfig);
    if (user?.uid) {
        const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
            setUserProfile(doc.data() as UserProfile);
        });
        return () => unsub();
    } 
  }, [user, router]);

  // Fetch creator earnings and vesting
  useEffect(() => {
      if(userProfile?.uid) {
          if (userProfile.isCreator) {
            calculateCreatorUsdtEarnings(userProfile.uid).then(setEarnings);
          }
          getVestingSchedules(userProfile.uid).then(setSchedules);
      }
  }, [userProfile]);

  const handlePurchase = async (ulcAmount: number, network: 'TRON' | 'TON', usdtCost: number) => {
    if (!user || !userProfile || !systemConfig) {
      toast({ variant: "destructive", title: t('errorTitle'), description: t('profileNotLoaded') });
      return;
    }

    const treasuryWallet = systemConfig.treasury_wallets[network];
    if (!treasuryWallet) {
         toast({ variant: "destructive", title: t('errorTitle'), description: t('treasuryNotConfigured', { network }) });
         return;
    }

    try {
        let txHash: string;
        if (network === 'TON') {
             if (!tonConnectUI.connected) {
                await tonConnectUI.openModal();
             }
            
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{ 
                    address: treasuryWallet, 
                    amount: (usdtCost * 1_000_000_000).toString() 
                }]
            });
            txHash = result.boc;
        } else {
             const provider = (window as any).tronWeb;
             if (!provider) throw new Error("TronLink not found. Please install TronLink.");
             
             const usdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; 
             const contract = await provider.contract().at(usdtContractAddress);
             const decimals = 6;
             const amountInSun = (usdtCost * Math.pow(10, decimals)).toString();
             
             const result = await contract.transfer(treasuryWallet, amountInSun).send();
             txHash = result;
        }
        
        await confirmUlcPurchase(userProfile, ulcAmount, network, txHash);

        toast({
            title: t('purchaseSuccess'),
            description: t('purchaseSuccessDesc', { ulc: ulcAmount }),
        });

    } catch (e: any) {
        console.error("Purchase failed", e);
        toast({
            variant: "destructive",
            title: t('purchaseFailed'),
            description: e.message || t('errorOccurred'),
        });
    }
  };

  const handleClaim = async () => {
    if (!userProfile?.creatorData) return;
    setClaimLoading(true);
    try {
        const claimId = await createClaimRequest(userProfile.creatorData);
        toast({
            title: t('claimSubmitted'),
            description: t('claimSubmittedDesc', { usdt: earnings.available.toFixed(2), id: claimId })
        });
        calculateCreatorUsdtEarnings(userProfile.uid).then(setEarnings); // Refresh earnings
    } catch (e: any) {
         toast({
            variant: "destructive",
            title: t('claimFailed'),
            description: e.message || t('defaultError'),
        });
    } finally {
        setClaimLoading(false);
    }
  };

  const handleVestingClaim = async (scheduleId: string) => {
    setVestingLoading(scheduleId);
    try {
        const result = await claimVestedULCAction(scheduleId);
        toast({
            title: t('claimSuccess'),
            description: t('vestingClaimedDesc', { amount: result.claimedAmount.toFixed(1) })
        });
        // Refresh
        if (userProfile?.uid) {
            getVestingSchedules(userProfile.uid).then(setSchedules);
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: t('claimFailed'), description: e.message });
    } finally {
        setVestingLoading(null);
    }
  };
  
  if (!isConnected || !user || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <h1 className="text-3xl font-headline font-bold">{t('loadingWallet')}</h1>
        <p className="text-muted-foreground">{t('connectToContinue')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push('/mypage')} className="h-10 w-10 rounded-full bg-white/5">
                <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
                <h1 className="text-4xl font-headline font-bold gradient-text">{t('myWallet')}</h1>
                <div className="flex items-center gap-2">
                    <p className="text-muted-foreground">{t('manageCredits')}</p>
                    <div className="bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono text-[10px] text-primary/70">
                        {user.walletAddress}
                    </div>
                </div>
            </div>
        </header>
        
        <div className="flex flex-col gap-6">
            <BalanceCard user={userProfile} onShowVesting={() => setShowVestingModal(true)} />

            <VestingDashboard 
                schedules={schedules} 
                onClaim={handleVestingClaim} 
                loading={vestingLoading} 
            />

            {userProfile.isCreator && (
                <UsdtEarningsCard 
                    creator={userProfile.creatorData || { uid: userProfile.uid, username: userProfile.username, subscriptionPriceMonthly: 0 }} 
                    onClaim={handleClaim} 
                    loading={claimLoading}
                    availableBalance={earnings.available}
                    pendingBalance={earnings.pending}
                />
            )}

            <BuyUlcCard user={userProfile} systemConfig={systemConfig} onPurchase={handlePurchase} />

            <div className="border-t border-white/5 pt-4">
                <HistoryCardLink />
            </div>
        </div>

        {/* Vesting Timeline Modal */}
        <Dialog open={showVestingModal} onOpenChange={setShowVestingModal}>
            <DialogContent className="max-w-2xl bg-[#0a0a0c] border-white/10 text-white p-0 overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                
                <DialogHeader className="p-8 pb-4">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-bold font-headline">
                        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                             <History className="w-5 h-5" />
                        </div>
                        {t('vestingTimeline')}
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-base">
                        {t('vestingTimelineDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-8 pt-2 space-y-6">
                    <div className="grid grid-cols-2 gap-4 pb-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-2">{t('totalLocked')}</p>
                            <p className="text-2xl font-bold font-mono text-orange-400">{userProfile.ulcBalance?.locked?.toFixed(1) || '0.0'} <span className="text-xs font-normal opacity-50 uppercase">ULC</span></p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-2">{t('activeSchedules')}</p>
                            <p className="text-2xl font-bold font-mono text-blue-400">{schedules.length}</p>
                        </div>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-white/5 pointer-events-none sticky top-0 z-10">
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('schedule')}</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('amount')}</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{t('startDate')}</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-right">{t('endDate')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedules.map((s) => (
                                    <TableRow key={s.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                        <TableCell className="py-4">
                                            <div className="font-bold text-sm">{s.description || 'Staking/Reward'}</div>
                                            <div className="text-[10px] text-muted-foreground opacity-50 font-mono">ID: {s.id.slice(0, 8)}</div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="font-bold text-sm font-mono">{s.totalAmount} <span className="text-[10px] opacity-50">ULC</span></div>
                                            <div className="text-[10px] text-green-500 font-medium">-{s.releasedAmount.toFixed(1)} {t('released')}</div>
                                        </TableCell>
                                        <TableCell className="py-4 text-xs opacity-70">
                                            {format(s.startTime, 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell className="py-4 text-xs font-bold text-right text-blue-400">
                                            {format(s.startTime + s.duration, 'MMM dd, yyyy')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4 flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-300/80 leading-relaxed italic">
                            {t('linearVestingNotice')}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

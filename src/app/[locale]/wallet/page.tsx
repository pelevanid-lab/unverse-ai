"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, VestingSchedule } from '@/lib/types';
import { confirmUlcPurchase, createClaimRequest, getSystemConfig, calculateCreatorUsdtEarnings, getVestingSchedules, claimVestedULCAction } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Wallet as WalletIcon, History, ExternalLink, Settings, ArrowRightLeft, ChevronLeft, Sparkles } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useTranslations } from 'next-intl';

// --- CONSTANTS ---
const ULC_PRICE_USDT = 0.015; // 1 ULC = 0.015 USDT

// --- SUB-COMPONENTS ---

function BalanceCard({ user }: { user: UserProfile | null }) {
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
                        <p className="text-xs text-primary/60 font-medium">Available to spend</p>
                    </div>
                    {lockedBalance > 0 && (
                        <div className="flex items-center gap-4 bg-orange-500/5 border border-orange-500/10 p-4 rounded-2xl">
                             <div className="space-y-0.5">
                                <p className="text-[10px] text-orange-400/70 font-bold uppercase tracking-tighter">Locked Assets</p>
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
                                    <span>Progress</span>
                                    <span>{progress.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5 p-0.5">
                                    <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }} />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold opacity-50">Released</p>
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

    // Sync amounts (1 ULC = 0.015 USDT)
    const handleUlcChange = (val: string) => {
        const num = Number(val);
        setUlcAmount(num);
        setUsdtAmount(Number((num * ULC_PRICE_USDT).toFixed(4)));
    };

    const handleUsdtChange = (val: string) => {
        const num = Number(val);
        setUsdtAmount(num);
        setUlcAmount(Number((num / ULC_PRICE_USDT).toFixed(0)));
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
        <Card className="glass-card lg:col-span-5 relative">
            <Link href="/payment-wallets" className="absolute top-4 right-4 z-10">
                <Button variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 gap-2 px-2 sm:px-4 h-9" title={t('paymentWallets')}>
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-medium">{t('paymentWallets')}</span>
                </Button>
            </Link>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{t('buyUlc')}</CardTitle>
                <CardDescription>
                    {t('buyUlcDesc')}
                    <br/>
                    <span className="text-primary font-bold">1 ULC = {ULC_PRICE_USDT} USDT</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>{t('ulcAmount')}</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={ulcAmount}
                                onChange={(e) => handleUlcChange(e.target.value)}
                                className="font-bold pl-12"
                                min="1"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">ULC</div>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center pb-2">
                        <ArrowRightLeft className="text-muted-foreground w-5 h-5 rotate-90 md:rotate-0" />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('usdtCost')}</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={usdtAmount}
                                onChange={(e) => handleUsdtChange(e.target.value)}
                                className="font-bold pl-14"
                                min="0.01"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-xs font-bold">USDT</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('selectNetwork')}</Label>
                    <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-6">
                        <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="TON" id="ton" />
                            <Label htmlFor="ton" className="cursor-pointer font-bold">TON</Label>
                        </div>
                        <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="TRON" id="tron" />
                            <Label htmlFor="tron" className="cursor-pointer font-bold">TRON</Label>
                        </div>
                    </RadioGroup>
                </div>

                <Button onClick={handlePurchase} disabled={isProcessing || !user || !systemConfig || usdtAmount <= 0} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <DollarSign className="w-5 h-5 mr-2" />}
                    {t('payButton', { usdt: usdtAmount, ulc: ulcAmount })}
                </Button>
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
            <BalanceCard user={userProfile} />

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
    </div>
  );
}

"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig, VestingSchedule } from '@/lib/types';
import { confirmUlcPurchase, createClaimRequest, getSystemConfig, calculateCreatorUsdcEarnings, getVestingSchedules, claimVestedULCAction, calculateProtocolFloorPrice } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Wallet as WalletIcon, History, ExternalLink, Settings, ArrowRightLeft, ChevronLeft, Sparkles, ShieldCheck, ArrowUpRight, Send, Lock, Milestone, ArrowRight } from 'lucide-react';
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
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
// ULC_PRICE_USDC is now dynamic

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

function BuyUlcCard({ user, systemConfig, onPurchase, isSmartWallet }: { user: UserProfile, systemConfig: SystemConfig | null, onPurchase: (ulcAmount: number, usdcCost: number) => Promise<void>, isSmartWallet?: boolean }) {
    const t = useTranslations('Wallet');
    const [ulcAmount, setUlcAmount] = useState<number>(1000);
    const [usdcAmount, setUsdcAmount] = useState<number>(15);
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
        : (systemConfig?.listingPriceUSDC || 0.015);

    // First Purchase Bonus Logic
    const isFirstPurchase = !user?.firstPurchaseBonusClaimed;
    const bonusAmount = isFirstPurchase ? Math.floor(Math.min(ulcAmount * 0.5, 85)) : 0;
    const totalWithBonus = ulcAmount + bonusAmount;

    // Sync amounts
    const handleUlcChange = (val: string) => {
        const num = Math.max(0, Number(val));
        setUlcAmount(num);
        setUsdcAmount(Number((num * currentPrice).toFixed(4)));
    };

    const handleUsdcChange = (val: string) => {
        const num = Math.max(0, Number(val));
        setUsdcAmount(num);
        setUlcAmount(Number((num / currentPrice).toFixed(0)));
    };

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            await onPurchase(ulcAmount, usdcAmount);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="glass-card lg:col-span-12 relative overflow-hidden group border-white/5">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:bg-primary/10 transition-colors" />
            
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
                        <Label className="text-xs font-bold text-muted-foreground uppercase opacity-70 tracking-tighter">{t('usdcCost')}</Label>
                        <div className="relative group">
                            <Input
                                type="number"
                                value={usdcAmount}
                                onChange={(e) => handleUsdcChange(e.target.value)}
                                className="h-16 text-3xl font-bold pl-20 bg-black/20 border-white/10 focus:border-primary/50 transition-all rounded-2xl"
                                min="0.01"
                            />
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-green-500/40 font-black text-xl select-none group-focus-within:text-green-500 transition-colors">USDC</div>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Base</Badge>
                        </div>
                        <div>
                            <p className="text-sm font-bold">Base Network</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">Native USDC Payment</p>
                        </div>
                    </div>
                    {isSmartWallet ? (
                        <div className="flex flex-col items-end">
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] font-bold">Gas-less Ready</Badge>
                            <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">Fee paid in USDC</p>
                        </div>
                    ) : (
                        <ShieldCheck className="w-5 h-5 text-green-500/50" />
                    )}
                </div>

                <Button 
                    onClick={() => onPurchase(ulcAmount, usdcAmount)} 
                    disabled={isProcessing || !user || !systemConfig || usdcAmount <= 0} 
                    className="w-full h-16 text-xl font-bold shadow-xl shadow-primary/20 bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-2xl group"
                >
                    {isProcessing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <DollarSign className="w-6 h-6" />
                            {isFirstPurchase ? (
                                <span>{t('payButton', { usdc: usdcAmount, ulc: totalWithBonus })} <span className="text-sm font-normal opacity-70">({ulcAmount} + {bonusAmount} Bonus)</span></span>
                            ) : (
                                <span>{t('payButton', { usdc: usdcAmount, ulc: ulcAmount })}</span>
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

function UsdcEarningsCard({ creator, onClaim, loading, availableBalance, pendingBalance }: { creator: Creator, onClaim: () => void, loading: boolean, availableBalance: number, pendingBalance: number }) {
    const t = useTranslations('Wallet');
    return (
        <Card className="glass-card lg:col-span-12 relative border-white/10 overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    {t('usdcEarnings')}
                </CardTitle>
                <CardDescription>{t('usdcEarningsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                 <div className="md:col-span-4 space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-2">{t('availableToClaim')}</p>
                    <p className="text-2xl font-bold font-headline text-green-400">{availableBalance.toFixed(2)} <span className="text-xs font-normal opacity-50 uppercase">USDC</span></p>
                </div>
                <div className="md:col-span-4 space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-2">{t('pendingClaim')}</p>
                    <p className="text-2xl font-bold font-headline text-orange-400/70">{pendingBalance.toFixed(2)} <span className="text-xs font-normal opacity-50 uppercase">USDC</span></p>
                </div>
                <div className="md:col-span-4 mt-2">
                    <Button 
                        onClick={onClaim} 
                        disabled={loading || availableBalance <= 0} 
                        className="w-full h-14 font-bold bg-green-600 hover:bg-green-700 transition-all active:scale-95 text-white shadow-xl shadow-green-500/10"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
                        {t('claimFunds')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function WithdrawUsdcCard({ onWithdraw, isSmartWallet }: { onWithdraw: (address: string, amount: number) => Promise<void>, isSmartWallet?: boolean }) {
    const t = useTranslations('Wallet');
    const [address, setAddress] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    const handleWithdraw = async () => {
        setLoading(true);
        try {
            await onWithdraw(address, amount);
            setAddress('');
            setAmount(0);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="glass-card lg:col-span-6 border-white/10 group overflow-hidden relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Send className="w-4 h-4 text-primary" />
                    </div>
                    {t('withdrawUsdc')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground opacity-70 flex justify-between">
                        {t('targetAddress')}
                        {isSmartWallet && <Badge className="bg-green-500/10 text-green-400 text-[8px] border-none font-black h-4 px-1">Gas-less</Badge>}
                    </Label>
                    <Input 
                        placeholder="0x..." 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)}
                        className="bg-black/20 border-white/5 h-12 focus:border-primary/50 transition-all font-mono text-xs"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground opacity-70">{t('amountToWithdraw')}</Label>
                    <div className="relative group">
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            value={amount || ''} 
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="bg-black/20 border-white/5 h-12 pr-16 focus:border-primary/50 transition-all font-bold"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground group-focus-within:text-primary transition-colors">USDC</span>
                    </div>
                </div>
                <Button 
                    onClick={handleWithdraw} 
                    disabled={loading || !address || !amount} 
                    className="w-full h-12 font-bold group bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all active:scale-95"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />}
                    {t('withdrawBtn')}
                </Button>
            </CardContent>
        </Card>
    );
}

function WithdrawUlcCard() {
    const t = useTranslations('Wallet');
    return (
        <Card className="glass-card lg:col-span-6 border-white/5 relative group overflow-hidden">
             <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center p-6 text-center backdrop-blur-[4px]">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-3 shadow-inner">
                    <Lock className="w-6 h-6 text-white/50 animate-pulse" />
                </div>
                <p className="text-xs font-black text-white/90 uppercase tracking-widest">{t('mainnetNotice')}</p>
                <Badge variant="outline" className="mt-2 border-primary/40 text-primary text-[8px] uppercase font-black mb-4">Coming with Mainnet</Badge>
                <Link href="/community#roadmap" className="group/nav relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-full blur opacity-10 group-hover/nav:opacity-50 transition duration-1000"></div>
                    <Button variant="outline" size="sm" className="relative h-8 rounded-full border-primary/30 text-white font-bold px-4 gap-2 bg-black hover:bg-zinc-900 text-[10px] transition-all">
                        <Milestone className="w-3 h-3 text-primary" />
                        VIEW ROADMAP
                        <ArrowRight className="w-3 h-3 group-hover/nav:translate-x-0.5 transition-transform" />
                    </Button>
                </Link>
            </div>
            <CardHeader className="opacity-10 blur-[1px]">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Send className="w-4 h-4" />
                    {t('withdrawUlc')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 opacity-10 blur-[2px] pointer-events-none">
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Address</Label>
                    <Input disabled className="bg-black/20 border-white/5 h-12" />
                </div>
                <Button disabled className="w-full h-12 font-bold">
                    {t('withdrawBtn')}
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
  const { chain, connector } = useAccount();
  const isSmartWallet = connector?.id === 'coinbaseWallet';
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [vestingLoading, setVestingLoading] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ available: number, pending: number }>({ available: 0, pending: 0 });
  const [schedules, setSchedules] = useState<VestingSchedule[]>([]);
  const [showVestingModal, setShowVestingModal] = useState(false);
  const [isPurchaseProcessing, setIsPurchaseProcessing] = useState(false);

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
            calculateCreatorUsdcEarnings(userProfile.uid).then(setEarnings);
          }
          getVestingSchedules(userProfile.uid).then(setSchedules);
      }
  }, [userProfile]);

  const handlePurchase = async (ulcAmount: number, usdcCost: number) => {
    if (!user || !userProfile || !systemConfig) {
      toast({ variant: "destructive", title: t('errorTitle'), description: t('profileNotLoaded') });
      return;
    }

    const treasuryAddress = systemConfig.treasury_address;
    if (!treasuryAddress) {
         toast({ variant: "destructive", title: t('errorTitle'), description: t('treasuryNotConfigured') });
         return;
    }

    setIsPurchaseProcessing(true);
    try {
        // 1. Ensure we are on Base
        if (chain?.id !== base.id) {
            try {
                await switchChainAsync({ chainId: base.id });
            } catch (switchError) {
                throw new Error("Please switch to Base network to complete the purchase.");
            }
        }

        // 2. Execute USDC Transfer
        // Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const usdcDecimals = 6;
        const amountInUnits = parseUnits(usdcCost.toString(), usdcDecimals);

        const txHash = await writeContractAsync({
            address: usdcAddress as `0x${string}`,
            abi: [
                {
                    constant: false,
                    inputs: [
                        { name: "_to", type: "address" },
                        { name: "_value", type: "uint256" }
                    ],
                    name: "transfer",
                    outputs: [{ name: "", type: "bool" }],
                    type: "function"
                }
            ],
            functionName: 'transfer',
            args: [treasuryAddress as `0x${string}`, amountInUnits],
            // @ts-ignore - capabilities is an experimental feature in wagmi
            capabilities: {
                paymasterService: {
                    url: process.env.NEXT_PUBLIC_PAYMASTER_URL
                }
            }
        });
        
        await confirmUlcPurchase(userProfile, ulcAmount, 'Base', txHash);

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
    } finally {
        setIsPurchaseProcessing(false);
    }
  };

  const handleClaim = async () => {
    if (!userProfile?.creatorData) return;
    setClaimLoading(true);
    try {
        const claimId = await createClaimRequest(userProfile.creatorData, userProfile.walletAddress);
        toast({
            title: t('claimSubmitted'),
            description: t('claimSubmittedDesc', { usdc: earnings.available.toFixed(2), id: claimId })
        });
        calculateCreatorUsdcEarnings(userProfile.uid).then(setEarnings); // Refresh earnings
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

  const handleWithdrawUsdc = async (recipientAddress: string, amount: number) => {
    if (!userProfile) return;
    
    try {
        if (chain?.id !== base.id) {
            try {
                await switchChainAsync({ chainId: base.id });
            } catch (switchError) {
                throw new Error("Please switch to Base network to complete the withdrawal.");
            }
        }

        const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const amountInUnits = parseUnits(amount.toString(), 6);

        await writeContractAsync({
            address: usdcAddress as `0x${string}`,
            abi: [
                {
                    constant: false,
                    inputs: [
                        { name: "_to", type: "address" },
                        { name: "_value", type: "uint256" }
                    ],
                    name: "transfer",
                    outputs: [{ name: "", type: "bool" }],
                    type: "function"
                }
            ],
            functionName: 'transfer',
            args: [recipientAddress as `0x${string}`, amountInUnits],
            // @ts-ignore - capabilities is an experimental feature in wagmi
            capabilities: {
                paymasterService: {
                    url: process.env.NEXT_PUBLIC_PAYMASTER_URL
                }
            }
        });

        toast({
            title: t('withdrawSuccess'),
            description: t('withdrawSuccessDesc', { amount, address: recipientAddress }),
        });

    } catch (e: any) {
        toast({
            variant: "destructive",
            title: t('errorTitle'),
            description: e.message || t('errorOccurred'),
        });
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
                <UsdcEarningsCard 
                    creator={userProfile.creatorData || { uid: userProfile.uid, username: userProfile.username, subscriptionPriceMonthly: 0 }} 
                    onClaim={handleClaim} 
                    loading={claimLoading}
                    availableBalance={earnings.available}
                    pendingBalance={earnings.pending}
                />
            )}
            <BuyUlcCard 
                user={userProfile} 
                systemConfig={systemConfig} 
                onPurchase={handlePurchase} 
                // @ts-ignore
                isProcessing={isPurchaseProcessing}
                isSmartWallet={isSmartWallet}
            />

            {/* WITHDRAWAL SECTION */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/5" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{t('withdrawTitle')}</h2>
                    <div className="h-px flex-1 bg-white/5" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <WithdrawUsdcCard 
                        onWithdraw={handleWithdrawUsdc}
                        isSmartWallet={isSmartWallet}
                    />
                    <WithdrawUlcCard />
                </div>
            </div>

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

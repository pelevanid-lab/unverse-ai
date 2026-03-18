
"use client"

import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, History, ShoppingBag, Lock, RefreshCw, ChevronLeft, CheckCircle, XCircle, Star, Loader2, Wallet as WalletIcon, ExternalLink, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { confirmUlcPurchase, getSystemConfig, createClaimRequest, calculateCreatorUsdtEarnings } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { SystemConfig, UserProfile, Creator } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';


function BalanceCard({ user }: { user: UserProfile | null }) {
    const available = user?.ulcBalance?.available ?? 0;
    const staked = (user?.ulcBalance as any)?.staked ?? 0; // Temp fix for staked which might not be in type

    return (
        <Card className="glass-card border-white/10">
            <CardHeader><CardTitle className="flex items-center gap-2"><WalletIcon /> Wallet Overview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground">Available ULC</p>
                    <p className="text-3xl font-bold">{available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground">Locked (Staked) ULC</p>
                    <p className="text-3xl font-bold">{staked.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function BuyUlcCard({ user, systemConfig, onPurchase }: { user: UserProfile, systemConfig: SystemConfig | null, onPurchase: (amount: number, network: 'TRON' | 'TON') => Promise<void> }) {
    const [usdtAmount, setUsdtAmount] = useState('10');
    const [purchaseState, setPurchaseState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>(user.preferredPaymentNetwork || 'TRON');

    const ulcToReceive = useMemo(() => {
        if (!systemConfig) return 0;
        const amount = parseFloat(usdtAmount);
        return isNaN(amount) ? 0 : amount / systemConfig.internal_ulc_purchase_price;
    }, [usdtAmount, systemConfig]);

    const handleBuyClick = async () => {
        const amount = parseFloat(usdtAmount);
        if (isNaN(amount) || amount <= 0) return;
        setPurchaseState('pending');
        try {
            await onPurchase(amount, selectedNetwork);
            setPurchaseState('success');
        } catch (err) {
            setPurchaseState('error');
        } finally {
            setTimeout(() => setPurchaseState('idle'), 3000);
        }
    };

    return (
        <Card className="glass-card border-white/10"> 
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><ShoppingBag/> Buy ULC</CardTitle>
                    <CardDescription>Purchase ULC tokens with USDT.</CardDescription>
                </div>
                <Link href="/payment-wallets">
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
                        <WalletIcon className="w-4 h-4"/> Payment Wallets
                    </Button>
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                 <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="grid grid-cols-2 gap-2">
                    <div><RadioGroupItem value="TRON" id="tron" className="peer sr-only" /><Label htmlFor="tron" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">TRON</Label></div>
                    <div><RadioGroupItem value="TON" id="ton" className="peer sr-only" /><Label htmlFor="ton" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent peer-data-[state=checked]:border-primary cursor-pointer">TON</Label></div>
                </RadioGroup>
                <div className="space-y-1">
                    <Label htmlFor="usdt-amount">You Spend (USDT)</Label>
                    <Input id="usdt-amount" type="number" value={usdtAmount} onChange={e => setUsdtAmount(e.target.value)} placeholder="e.g., 100" />
                </div>
                <div className="text-center p-4 rounded-lg bg-background/50">
                    <p className="text-sm text-muted-foreground">You Receive (approx.)</p>
                    <p className="text-2xl font-bold text-primary">{ulcToReceive.toFixed(2)} ULC</p>
                </div>
                <Button onClick={handleBuyClick} disabled={purchaseState !== 'idle' || !systemConfig} className="w-full h-12">
                    {purchaseState === 'pending' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                    {purchaseState === 'success' && <><CheckCircle className="mr-2 h-4 w-4" /> Success!</>}
                    {purchaseState === 'error' && <><XCircle className="mr-2 h-4 w-4" /> Failed</>}
                    {purchaseState === 'idle' && 'Buy ULC'}
                </Button>
            </CardContent>
        </Card>
    );
}

function UsdtEarningsCard({ creator, onClaim, loading }: { creator: Creator, onClaim: () => void, loading: boolean }) {
    const [earnings, setEarnings] = useState<{ available: number, pending: number }>({ available: 0, pending: 0 });
    useEffect(() => {
        if (!creator.uid) return;
        calculateCreatorUsdtEarnings(creator.uid).then(setEarnings);
    }, [creator.uid]);
    const canClaim = earnings.available > 0 && earnings.pending === 0;
    return (
        <Card className="glass-card border-white/10 bg-gradient-to-br from-purple-500/10 to-blue-500/10">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">USDT Earnings</CardTitle>
                    <CardDescription>Claim your earnings from subscriptions.</CardDescription>
                </div>
                <Link href="/creator/collection-wallets">
                     <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
                        <WalletIcon className="w-4 h-4"/> Collection Wallets
                    </Button>
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-background/50"><p className="text-sm text-muted-foreground">Available to Claim</p><p className="text-3xl font-bold text-green-400">${earnings.available.toFixed(2)}</p></div>
                <div className="p-4 rounded-lg bg-background/50"><p className="text-sm text-muted-foreground">Pending Claims</p><p className="text-3xl font-bold">${earnings.pending.toFixed(2)}</p></div>
                <Button onClick={onClaim} disabled={!canClaim || loading} className="w-full h-12">
                   {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                   {canClaim ? 'Request Claim' : (earnings.pending > 0 ? 'Claim is Pending' : 'No Earnings to Claim')}
                </Button>
            </CardContent>
        </Card>
    );
}

function HistoryCardLink() {
    return (
        <Link href="/wallet/history">
            <Card className="glass-card lg:col-span-2 border-white/10 hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><History/> Transaction History</span>
                        <ExternalLink className="w-5 h-5 text-muted-foreground"/>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">View your complete transaction history.</p>
                </CardContent>
            </Card>
        </Link>
    )
}

// --- MAIN WALLET PAGE ---
export default function WalletPage() {
  const router = useRouter();
  const { user, isConnected } = useWallet();
  const { toast } = useToast();
  
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  
  useEffect(() => {
    getSystemConfig().then(setSystemConfig).catch(err => toast({ variant: 'destructive', title: 'Error', description: 'Could not load system configuration.' }));
  }, [toast]);

  const handlePurchase = async (amount: number, network: 'TRON' | 'TON') => {
    if (!user) throw new Error("User not connected");
    toast({ title: 'Action Required', description: 'Please confirm transaction in your wallet.' });
    // This is a mock, replace with actual transaction call
    const fakeTxHash = `fake_tx_${Date.now()}`;
    try {
        await confirmUlcPurchase(user, amount, network, fakeTxHash);
        toast({ title: 'Purchase Confirmed', description: 'ULC balance will update shortly.' });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Purchase Failed', description: msg });
        throw error;
    }
  };

  const handleClaimRequest = async () => {
      if (!user?.isCreator) return;
      setClaimLoading(true);
      try {
          await createClaimRequest(user as Creator);
          toast({ title: 'Claim Request Submitted', description: 'Your request is pending admin approval.' });
      } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to submit claim.';
          toast({ variant: 'destructive', title: 'Claim Failed', description: msg });
      } finally {
          setClaimLoading(false);
      }
  }

  if (!isConnected || !user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <WalletIcon className="w-16 h-16 mb-4 text-primary" />
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="text-muted-foreground">Please connect your wallet to continue.</p>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4">
        <header className="flex items-center justify-between pt-8">
          <div>
             <h1 className="text-5xl font-headline font-bold gradient-text">My Wallet</h1>
             <p className="text-muted-foreground">Your central dashboard for transactions and earnings.</p>
          </div>
          <Button onClick={() => router.back()} variant="ghost"><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <BalanceCard user={user} />
                <BuyUlcCard user={user} systemConfig={systemConfig} onPurchase={handlePurchase} />
            </div>

            <div className="lg:col-span-2 space-y-6">
                 {user.isCreator && <UsdtEarningsCard creator={user as Creator} onClaim={handleClaimRequest} loading={claimLoading} />}
                 <HistoryCardLink />
            </div>
        </div>
    </div>
  );
}


"use client"

import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, ArrowUpRight, ArrowDownLeft, History, ShoppingBag, Lock, RefreshCw, ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { confirmUlcPurchase, getSystemConfig, claimVestedTokens, calculateVestingClaimable } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, VestingSchedule, SystemConfig } from '@/lib/types';

// TRON USDT Contract Address
const USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export default function WalletPage() {
  const router = useRouter();
  const { user, isConnected, rawAddress } = useWallet();
  const [usdtAmount, setUsdtAmount] = useState('10');
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [schedules, setSchedules] = useState<VestingSchedule[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    getSystemConfig().then(setSystemConfig);

    if (!user || !rawAddress) return;
    
    const addressFormats = Array.from(new Set([user.walletAddress, rawAddress]));

    const qIn = query(collection(db, 'ledger'), where('toWallet', 'in', addressFormats), orderBy('timestamp', 'desc'), limit(20));
    const qOut = query(collection(db, 'ledger'), where('fromWallet', 'in', addressFormats), orderBy('timestamp', 'desc'), limit(20));

    const unsubIn = onSnapshot(qIn, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
      setHistory(prev => [...prev, ...data].sort((a, b) => b.timestamp - a.timestamp).filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i));
    });

    const unsubOut = onSnapshot(qOut, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
      setHistory(prev => [...prev, ...data].sort((a, b) => b.timestamp - a.timestamp).filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i));
    });

    const qSchedules = query(collection(db, 'vesting'), where('uid', '==', user.uid));
    const unsubSchedules = onSnapshot(qSchedules, snap => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VestingSchedule)));
    });

    return () => { unsubIn(); unsubOut(); unsubSchedules(); };
  }, [user, rawAddress]);

  const handleBuy = async () => {
    if (!isConnected || !user || !systemConfig) return;

    if (!user.paymentWalletAddress) {
        toast({
            variant: 'destructive',
            title: "Payment Wallet Not Configured",
            description: "Please configure your TRON payment wallet in Settings.",
            action: <Button onClick={() => router.push('/mypage')}>Go to Settings</Button>
        });
        return;
    }
    
    const tronWeb = (window as any).tronWeb;
    if (!tronWeb || tronWeb.defaultAddress.base58.toLowerCase() !== user.paymentWalletAddress.toLowerCase()) {
        toast({ variant: 'destructive', title: "Incorrect Wallet Selected", description: `Please switch to your configured payment wallet (${user.paymentWalletAddress.slice(0, 6)}...) in your TronLink extension.` });
        return;
    }

    const amount = parseFloat(usdtAmount);
    if (isNaN(amount) || amount <= 0) {
        toast({ variant: 'destructive', title: "Invalid Amount", description: "Please enter a valid USDT amount." });
        return;
    }

    setPurchaseState('pending');
    try {
      const toAddress = systemConfig.wallets.treasury_wallet.address;
      if (!toAddress) throw new Error("Treasury address not configured.");
      
      const amountInSun = amount * 1_000_000; // USDT has 6 decimals

      const contract = await tronWeb.contract().at(USDT_CONTRACT_ADDRESS);
      const txHash = await contract.transfer(toAddress, amountInSun).send({ feeLimit: 100_000_000 });

      if (!txHash) throw new Error("Transaction failed to broadcast.");

      const creditedUlc = await confirmUlcPurchase(user, amount, txHash);
      
      setPurchaseState('success');
      toast({ 
        title: "Purchase Successful!", 
        description: `You received ${creditedUlc.toFixed(2)} ULC. Your balance will update shortly.`
      });

    } catch (e: any) {
        setPurchaseState('failed');
        console.error("Purchase process failed:", e);
        toast({ 
            variant: 'destructive', 
            title: "Purchase Failed", 
            description: e.message || "The transaction was rejected or failed."
        });
    } finally {
        setTimeout(() => setPurchaseState('idle'), 3000);
    }
  };

  const handleClaim = async (schedule: VestingSchedule) => {
    if (!user) return;
    setClaiming(true);
    try {
      await claimVestedTokens(user, schedule);
      toast({ title: "Tokens Claimed" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Claim Failed", description: e.message });
    }
    setClaiming(false);
  };
  
  const renderPurchaseButton = () => {
    switch (purchaseState) {
        case 'pending':
            return <RefreshCw className="animate-spin" />;
        case 'success':
            return <CheckCircle className="text-green-500" />;
        case 'failed':
            return <XCircle className="text-red-500" />;
        default:
            return 'Purchase';
    }
  }

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Coins className="w-16 h-16 text-primary" />
      <h1 className="text-3xl font-headline font-bold">Connect Wallet</h1>
      <p className="text-muted-foreground">Manage your digital assets.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          onClick={() => router.back()}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
            <h1 className="text-4xl font-headline font-bold gradient-text">My Wallet</h1>
            <p className="text-muted-foreground font-mono text-xs">{user?.walletAddress}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-primary">Available</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold font-headline">{user?.ulcBalance.available.toFixed(2)} ULC</div></CardContent>
        </Card>
        <Card className="bg-muted border-white/5">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Locked</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold font-headline">{user?.ulcBalance.locked.toFixed(2)} ULC</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" /> Buy ULC</CardTitle>
            <CardDescription>Exchange USDT for platform tokens via TRON network.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">USDT Amount</label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  value={usdtAmount} 
                  onChange={(e) => setUsdtAmount(e.target.value)}
                  className="bg-muted border-none h-12"
                  disabled={purchaseState === 'pending'}
                />
                <Button onClick={handleBuy} disabled={purchaseState !== 'idle'} className="bg-primary px-8 w-32">
                  {renderPurchaseButton()}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Estimated Receipt: <span className="text-primary font-bold">{(parseFloat(usdtAmount) / (systemConfig?.internal_ulc_purchase_price || 0.015)).toFixed(2)} ULC</span></p>
            </div>

            {schedules.length > 0 && (
              <div className="pt-6 border-t space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4" /> Vesting Schedules</h4>
                {schedules.map(s => {
                  const claimable = calculateVestingClaimable(s);
                  return (
                    <div key={s.id} className="p-3 bg-muted/20 rounded-xl border border-white/5 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold capitalize">{s.type} Pool</p>
                        <p className="text-[10px] text-muted-foreground">Progress: {((s.claimedAmount / s.totalAmount) * 100).toFixed(1)}%</p>
                      </div>
                      <Button size="sm" disabled={claimable <= 0 || claiming} onClick={() => handleClaim(s)}>
                        {claiming ? '...' : `Claim ${claimable.toFixed(1)}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" /> History</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto space-y-4">
            {history.map((tx) => {
              const isIncoming = tx.toWallet.toLowerCase() === user?.walletAddress.toLowerCase();
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    {isIncoming ? <ArrowDownLeft className="text-green-400" /> : <ArrowUpRight className="text-red-400" />}
                    <div>
                      <p className="text-sm font-bold capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${isIncoming ? 'text-green-400' : 'text-red-400'}`}>
                    {isIncoming ? '+' : '-'}{tx.amount.toFixed(2)} {tx.currency}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

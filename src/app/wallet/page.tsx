
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, ArrowUpRight, ArrowDownLeft, History, ShoppingBag, Lock, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { buyULC, claimVestedTokens, calculateVestingClaimable } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, VestingSchedule } from '@/lib/types';

export default function WalletPage() {
  const { user, isConnected } = useWallet();
  const [usdtAmount, setUsdtAmount] = useState('10');
  const [buying, setBuying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [schedules, setSchedules] = useState<VestingSchedule[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    
    const qIn = query(
      collection(db, 'ledger'),
      where('toWallet', '==', user.walletAddress),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const qOut = query(
      collection(db, 'ledger'),
      where('fromWallet', '==', user.walletAddress),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubIn = onSnapshot(qIn, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
      setHistory(prev => {
        const combined = [...prev, ...data].sort((a, b) => b.timestamp - a.timestamp);
        return Array.from(new Set(combined.map(t => t.id))).map(id => combined.find(t => t.id === id)!);
      });
    });

    const unsubOut = onSnapshot(qOut, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
      setHistory(prev => {
        const combined = [...prev, ...data].sort((a, b) => b.timestamp - a.timestamp);
        return Array.from(new Set(combined.map(t => t.id))).map(id => combined.find(t => t.id === id)!);
      });
    });

    const qSchedules = query(collection(db, 'vesting'), where('uid', '==', user.uid));
    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      setSchedules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VestingSchedule)));
    });

    return () => { unsubIn(); unsubOut(); unsubSchedules(); };
  }, [user]);

  const handleBuy = async () => {
    if (!isConnected || !user) return;
    setBuying(true);
    try {
      const amount = await buyULC(user, parseFloat(usdtAmount));
      toast({ title: "Purchase Success", description: `Received ${amount.toFixed(2)} ULC!` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Purchase Failed" });
    }
    setBuying(false);
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

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Coins className="w-16 h-16 text-primary" />
      <h1 className="text-3xl font-headline font-bold">Connect Wallet</h1>
      <p className="text-muted-foreground">Manage your digital assets.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header>
        <h1 className="text-4xl font-headline font-bold gradient-text">My Wallet</h1>
        <p className="text-muted-foreground font-mono text-xs">{user?.walletAddress}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{user?.ulcBalance.available.toFixed(2)} ULC</div>
          </CardContent>
        </Card>
        <Card className="bg-muted border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Locked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-headline">{user?.ulcBalance.locked.toFixed(2)} ULC</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" /> Buy ULC</CardTitle>
            <CardDescription>Exchange USDT for platform tokens.</CardDescription>
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
                />
                <Button onClick={handleBuy} disabled={buying} className="bg-primary px-8">
                  {buying ? <RefreshCw className="animate-spin" /> : 'Purchase'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Estimated Receipt: <span className="text-primary font-bold">{(parseFloat(usdtAmount) / 0.015).toFixed(2)} ULC</span></p>
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
              const isIncoming = tx.toWallet === user?.walletAddress;
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    {isIncoming ? <ArrowDownLeft className="text-green-400" /> : <ArrowUpRight className="text-red-400" />}
                    <div>
                      <p className="text-sm font-bold capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</p>
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

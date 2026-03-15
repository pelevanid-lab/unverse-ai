"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Coins, ArrowUpRight, ArrowDownLeft, History, ShoppingBag, Lock, Gift } from 'lucide-react';
import { useState } from 'react';
import { buyULC } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';

export default function WalletPage() {
  const { user, isConnected } = useWallet();
  const [usdtAmount, setUsdtAmount] = useState('10');
  const [buying, setBuying] = useState(false);
  const { toast } = useToast();

  const handleBuy = async () => {
    if (!isConnected) return;
    setBuying(true);
    try {
      const amount = await buyULC(user!.walletAddress, parseFloat(usdtAmount));
      toast({ title: "Purchase Success", description: `You received ${amount.toFixed(2)} ULC!` });
    } catch (e) {
      toast({ title: "Error", description: "Purchase failed." });
    }
    setBuying(false);
  };

  if (!isConnected) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-headline font-bold gradient-text">Wallet</h1>
        <p className="text-muted-foreground">Manage your ULC and USDT assets.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.ulcBalance.available.toFixed(2)} ULC</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-orange-400">Locked (Vesting)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.ulcBalance.locked.toFixed(2)} ULC</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-400">Claimable</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            <div className="text-2xl font-bold">{user?.ulcBalance.claimable.toFixed(2)} ULC</div>
            <Button variant="secondary" size="sm" disabled={user?.ulcBalance.claimable === 0}>Claim</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> Buy ULC
            </CardTitle>
            <CardDescription>Instant purchase via USDT (1 ULC = 0.015 USDT)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">USDT Amount</label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  value={usdtAmount} 
                  onChange={(e) => setUsdtAmount(e.target.value)}
                  className="bg-muted"
                />
                <Button onClick={handleBuy} disabled={buying} className="bg-primary hover:bg-primary/90">
                  {buying ? 'Processing...' : 'Purchase'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">You will receive {(parseFloat(usdtAmount) / 0.015).toFixed(2)} ULC</p>
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Presale (Vesting)</span>
                <span className="text-primary font-bold">1 ULC = 0.01 USDT</span>
              </div>
              <Button variant="outline" className="w-full">Participate in Presale</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-full"><Gift className="w-4 h-4 text-primary" /></div>
                  <div>
                    <div className="text-sm font-bold">Welcome Gift</div>
                    <div className="text-xs text-muted-foreground">Platform Bonus</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-green-400">+100.00 ULC</div>
              </div>
            </div>
            <Button variant="ghost" className="w-full mt-4 text-xs">View All Transactions</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
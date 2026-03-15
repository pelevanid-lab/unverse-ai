"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Flame, Wallet, Users, Activity, Settings, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry } from '@/lib/types';

export default function AdminDashboard() {
  const { user, isConnected } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const conf = await getSystemConfig();
      setConfig(conf);
      if (user && conf && conf.admin_wallet_address === user.walletAddress) {
        setAuthorized(true);
      }
    };
    checkAuth();
  }, [user]);

  useEffect(() => {
    if (!authorized) return;
    const q = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      setRecentLedger(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    });
    return () => unsub();
  }, [authorized]);

  const handleInitialize = async () => {
    if (!user) return;
    try {
      const conf = await initializeSystemConfig(user.walletAddress);
      setConfig(conf);
      setAuthorized(true);
      toast({ title: "System Initialized", description: "You are now the platform admin." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <ShieldCheck className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-3xl font-headline font-bold">Admin Portal</h1>
      <p className="text-muted-foreground">Connect your wallet to access system tools.</p>
    </div>
  );

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold">Unauthorized</h1>
          <p className="text-muted-foreground max-w-md">Only the primary system wallet can access this panel. If this is a fresh install, initialize the system as admin.</p>
        </div>
        {!config && (
          <Button onClick={handleInitialize} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold px-8">
            Initialize System as Admin
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-yellow-400 flex items-center gap-3">
            <ShieldCheck className="w-10 h-10" /> Admin Console
          </h1>
          <p className="text-muted-foreground">Immutable Ledger & System Governance</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-yellow-400 text-black px-4 py-1">Super Admin</Badge>
          <Badge variant="outline" className="font-mono text-[10px]">{user?.walletAddress}</Badge>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-3 h-3" /> Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,024</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Coins className="w-3 h-3" /> Circulating Supply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5M ULC</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Flame className="w-3 h-3" /> Burned Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">450k ULC</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-3 h-3" /> Treasury Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">$125.4k USDT</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                <Database className="w-6 h-6 text-primary" /> Immutable Ledger
              </h2>
              <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
            <Card className="glass-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From / To</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLedger.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px]">{tx.type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground truncate w-24">F: {tx.fromWallet}</span>
                          <span className="text-primary truncate w-24">T: {tx.toWallet}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">
                        {tx.currency === 'ULC' ? (
                          <span className="text-primary">{tx.amount.toFixed(2)} $ULC</span>
                        ) : (
                          <span className="text-green-400">${tx.amount.toFixed(2)} USDT</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[10px] text-muted-foreground">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" /> System Wallets
            </h2>
            <Card className="glass-card">
              <CardContent className="p-4 space-y-4">
                {[
                  { label: 'Reserve Pool', address: config?.reserve_pool_address, amount: '420M ULC' },
                  { label: 'Genesis Wallet', address: config?.genesis_wallet_address, amount: '100M ULC' },
                  { label: 'Treasury USDT', address: config?.treasury_wallet_address, amount: '125k USDT' },
                  { label: 'Burn Pool', address: config?.burn_pool_address, amount: '450k ULC' },
                  { label: 'Staking Pool', address: config?.staking_pool_address, amount: '2.5M ULC' },
                ].map((wallet, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold">{wallet.label}</span>
                      <span className="font-bold text-primary">{wallet.amount}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate bg-muted/30 p-1 rounded">
                      {wallet.address}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary" /> Parameters
            </h2>
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ULC Price (USDT)</span>
                  <span className="font-bold">${config?.internal_ulc_purchase_price}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee</span>
                  <span className="font-bold">{(config?.subscription_split.platform * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unlock Commission</span>
                  <span className="font-bold">{(config?.premium_unlock_commission * 100).toFixed(1)}%</span>
                </div>
                <Button variant="outline" className="w-full text-xs mt-2" size="sm">Modify Rules</Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

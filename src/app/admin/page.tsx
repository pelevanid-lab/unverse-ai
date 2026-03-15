"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Activity, ShieldCheck, Database, Coins, Flame, Wallet, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const { user, isConnected } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (user) {
        const conf = await getSystemConfig();
        setConfig(conf);
        if (conf && conf.admin_wallet_address === user.walletAddress) {
          setAuthorized(true);
        }
      }
    };
    checkAuth();
  }, [user]);

  if (!isConnected || !authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-3xl font-headline font-bold">Access Denied</h1>
        <p className="text-muted-foreground">Only platform administrators can access this panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold text-yellow-400 flex items-center gap-3">
            <ShieldCheck className="w-10 h-10" /> Admin Panel
          </h1>
          <p className="text-muted-foreground">Full system oversight and ledger governance.</p>
        </div>
        <Badge className="bg-yellow-400 text-black px-4 py-1">Super Admin</Badge>
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
            <div className="text-2xl font-bold">450k ULC</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-3 h-3" /> Treasury Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$125.4k USDT</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" /> Live Ledger
            </h2>
            <Card className="glass-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell><Badge variant="outline">ulc_purchase</Badge></TableCell>
                    <TableCell>+500.00 ULC</TableCell>
                    <TableCell><Badge className="bg-green-500/20 text-green-400">Success</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">2 mins ago</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Badge variant="outline">premium_unlock</Badge></TableCell>
                    <TableCell>-5.00 ULC</TableCell>
                    <TableCell><Badge className="bg-green-500/20 text-green-400">Success</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">15 mins ago</TableCell>
                  </TableRow>
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
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Reserve Pool</span>
                  <span className="font-bold">420M ULC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Presale Pool</span>
                  <span className="font-bold">100M ULC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Treasury USDT</span>
                  <span className="font-bold">125k USDT</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Staking Pool</span>
                  <span className="font-bold">2.5M ULC</span>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
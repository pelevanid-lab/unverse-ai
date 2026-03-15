
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, seedMuses, toggleUserFreeze, triggerGenesisAllocation } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Users, Settings, PlusCircle, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, UserProfile, SystemConfig } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const { user, isConnected, walletAddress } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<string | boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!walletAddress) return;

    const unsubConfig = onSnapshot(doc(db, 'config', 'system'), (snap) => {
      const conf = snap.exists() ? (snap.data() as SystemConfig) : null;
      setConfig(conf);
      if (conf && conf.admin_wallet_address && walletAddress &&
          conf.admin_wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    });

    return () => unsubConfig();
  }, [walletAddress]);

  useEffect(() => {
    if (!authorized) return;
    
    const unsubLedger = onSnapshot(query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setRecentLedger(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => { unsubLedger(); unsubUsers(); };
  }, [authorized]);

  const handleInitialize = async () => {
    setLoading('init');
    try {
      const conf = await initializeSystemConfig();
      setConfig(conf);
      toast({ title: "System Initialized", description: "OASIS_ROSE Network and wallets established." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleSeedMuses = async () => {
    setLoading('seed');
    try {
      await seedMuses();
      toast({ title: "Muses Seeded" });
    } catch (e) {
      toast({ variant: "destructive", title: "Seeding Failed" });
    }
    setLoading(false);
  };

  const handleGenesisAllocation = async () => {
    if (!user) return;
    setLoading('claim');
    try {
      await triggerGenesisAllocation(user);
      toast({ title: "Allocation Complete", description: "50k ULC team grant assigned and vested." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Allocation Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleToggleFreeze = async (uid: string, currentStatus: boolean) => {
    try {
      await toggleUserFreeze(uid, !currentStatus);
      toast({ title: currentStatus ? "User Unfrozen" : "User Frozen" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Moderation Failed" });
    }
  };

  if (!isConnected) return <div className="min-h-[60vh] flex items-center justify-center">Connect Wallet to Continue</div>;

  if (!config && !authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
         <Loader2 className="w-16 h-16 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-3xl font-headline font-bold">Unauthorized Access</h1>
        <p className="text-muted-foreground max-w-sm">
          Your wallet address is not registered as the Platform Administrator.
        </p>
      </div>
    );
  }

  const walletsToRender = config && config.wallets 
    ? Object.entries(config.wallets).map(([id, data]) => ({ id, ...(data as any) })) 
    : [];

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-headline font-bold text-yellow-400">Admin Console</h1>
          <p className="text-xs font-mono opacity-50">Net: {config?.ulc_token_network || 'N/A'}</p>
        </div>
        <Badge className="bg-yellow-400 text-black">Master Key Active</Badge>
      </header>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="wallets">System Wallets</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="setup" className="space-y-6">
           <Card className="glass-card border-green-500/50">
             <CardHeader>
               <CardTitle>Step 1: System Initialization</CardTitle>
               <CardDescription>Initialize the entire token economy and create all system wallets. This is a one-time operation.</CardDescription>
             </CardHeader>
             <CardContent>
                <Button onClick={handleInitialize} disabled={loading || !!config?.genesis_initialized} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold">
                  {loading === 'init' ? <Loader2 className="animate-spin"/> : (config?.genesis_initialized ? 'System Already Initialized' : 'Initialize System Economy')}
                </Button>
             </CardContent>
           </Card>

           <Card className={`glass-card ${!config?.genesis_initialized ? 'opacity-50 pointer-events-none' : ''}`}>
             <CardHeader>
               <CardTitle>Step 2: Grant & Seed</CardTitle>
               <CardDescription>Allocate personal grants for the team and seed initial platform content. Requires Step 1.</CardDescription>
             </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={handleGenesisAllocation} disabled={loading || !config?.genesis_initialized} className="w-full h-12 bg-yellow-400 text-black font-bold">
                   {loading === 'claim' ? <Loader2 className="animate-spin"/> : 'Claim Team Allocation (50k ULC)'}
                </Button>
               <Button onClick={handleSeedMuses} disabled={loading || !config?.genesis_initialized} variant="outline" className="w-full h-12">
                {loading === 'seed' ? <Loader2 className="animate-spin"/> : 'Seed AI Muses'}
               </Button>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="wallets">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {walletsToRender.length > 0 ? walletsToRender.map(w => (
              <Card key={w.id} className="glass-card">
                <CardHeader className="pb-2 flex-row justify-between items-center">
                  <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{w.id.replace(/_/g, ' ')}</CardTitle>
                  <Badge variant="outline" className="text-[9px]">{w.currency}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{w.balance.toLocaleString()}</div>
                  <p className="text-xs font-mono opacity-50 truncate">{w.address}</p>
                </CardContent>
              </Card>
            )) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                System wallets not initialized. Complete Step 1 in the 'Setup' tab.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell><Badge variant="outline" className="text-[9px]">{tx.type}</Badge></TableCell>
                    <TableCell className="font-mono text-[10px]">{tx.fromWallet.slice(0, 12)}...</TableCell>
                    <TableCell className="font-mono text-[10px]">{tx.toWallet.slice(0, 12)}...</TableCell>
                    <TableCell className="font-bold">{tx.amount.toLocaleString()} {tx.currency}</TableCell>
                    <TableCell className="text-right text-[10px] opacity-50">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="glass-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Moderation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map(u => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-bold">{u.username || u.walletAddress.slice(0, 8)}</TableCell>
                    <TableCell>{u.ulcBalance.available.toFixed(1)} ULC</TableCell>
                    <TableCell>{u.isFrozen ? <Badge variant="destructive">Frozen</Badge> : <Badge className="bg-green-500">Active</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={u.isFrozen ? "outline" : "destructive"} onClick={() => handleToggleFreeze(u.uid, !!u.isFrozen)}>
                        {u.isFrozen ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

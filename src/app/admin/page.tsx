
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, seedMuses, toggleUserFreeze, triggerGenesisAllocation } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Users, Settings, PlusCircle, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, UserProfile, SystemConfig } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const { user, isConnected, walletAddress } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [systemWallets, setSystemWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const conf = await getSystemConfig();
      setConfig(conf);
      if (walletAddress && conf && conf.admin_wallet_address === walletAddress && walletAddress !== "") {
        setAuthorized(true);
      }
    };
    checkAuth();
  }, [walletAddress]);

  useEffect(() => {
    if (!authorized) return;
    
    const unsubLedger = onSnapshot(query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setRecentLedger(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubWallets = onSnapshot(collection(db, 'system_wallets'), (snap) => {
      setSystemWallets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLedger(); unsubUsers(); unsubWallets(); };
  }, [authorized]);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const conf = await initializeSystemConfig();
      setConfig(conf);
      toast({ title: "System Initialized", description: "OASIS_ROSE Network Established." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleSeedMuses = async () => {
    setLoading(true);
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
    setLoading(true);
    try {
      await triggerGenesisAllocation(user);
      toast({ title: "Genesis Triggered", description: "50k ULC team grant assigned." });
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

  if (!isConnected) return <div className="min-h-[60vh] flex items-center justify-center">Connect Wallet</div>;

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-3xl font-headline font-bold">Unauthorized</h1>
        {!config ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">Protocol not found. Initialize now.</p>
            <Button onClick={handleInitialize} disabled={loading} className="bg-yellow-400 text-black font-bold h-12 px-8">
              {loading ? 'Initializing...' : 'Initialize 16-Wallet Protocol'}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground max-w-sm">
            Access locked. Your wallet is not the Platform Admin.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-headline font-bold text-yellow-400">Admin Console</h1>
          <p className="text-xs font-mono opacity-50">Net: {config?.ulc_token_network}</p>
        </div>
        <Badge className="bg-yellow-400 text-black">Master Key Active</Badge>
      </header>

      <Tabs defaultValue="wallets" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14">
          <TabsTrigger value="wallets">System Wallets</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemWallets.map(w => (
              <Card key={w.id} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{w.id.replace(/_/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{w.balance.toLocaleString()} {w.currency}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell><Badge variant="outline" className="text-[9px]">{tx.type}</Badge></TableCell>
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
                    <TableCell className="font-bold">{u.username}</TableCell>
                    <TableCell>{u.ulcBalance.available.toFixed(1)} ULC</TableCell>
                    <TableCell>{u.isFrozen ? <Badge variant="destructive">Frozen</Badge> : <Badge className="bg-green-500">Active</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={u.isFrozen ? "outline" : "destructive"} onClick={() => handleToggleFreeze(u.uid, !!u.isFrozen)}>
                        {u.isFrozen ? 'Unfreeze' : 'Freeze'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
           <Card className="glass-card">
             <CardHeader>
               <CardTitle>Genesis & Seeding</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <Button onClick={handleSeedMuses} variant="outline" className="w-full h-12">Seed AI Muses</Button>
               <Button onClick={handleGenesisAllocation} className="w-full h-12 bg-yellow-400 text-black font-bold">Claim Genesis (50k ULC)</Button>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

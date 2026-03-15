"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, seedMuses, toggleUserFreeze } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Flame, Wallet, Users, Activity, Settings, RefreshCw, Sparkles, UserX, UserCheck, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, UserProfile } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateAiMuseProfileDescriptions } from '@/ai/flows/generate-ai-muse-profile-descriptions';

export default function AdminDashboard() {
  const { user, isConnected } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [museGenLoading, setMuseGenLoading] = useState(false);
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
    
    const qLedger = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(15));
    const unsubLedger = onSnapshot(qLedger, (snap) => {
      setRecentLedger(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    return () => {
      unsubLedger();
      unsubUsers();
    };
  }, [authorized]);

  const handleInitialize = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const conf = await initializeSystemConfig(user.walletAddress);
      setConfig(conf);
      setAuthorized(true);
      toast({ title: "System Initialized", description: "You are now the platform admin." });
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed" });
    }
    setLoading(false);
  };

  const handleSeedMuses = async () => {
    setLoading(true);
    try {
      await seedMuses();
      toast({ title: "Muses Seeded", description: "Official AI Muses have been added to the registry." });
    } catch (e) {
      toast({ variant: "destructive", title: "Seeding Failed" });
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

  const handleGenerateMuse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuseGenLoading(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('museName') as string;
    const category = formData.get('museCategory') as string;

    try {
      const profile = await generateAiMuseProfileDescriptions({ name, category });
      const newMuse = {
        id: name.toLowerCase().replace(/\s/g, '_'),
        name,
        category,
        ...profile,
        avatar: `https://picsum.photos/seed/${name}/400/400`,
        isOfficial: true
      };
      await addDoc(collection(db, 'muses'), newMuse);
      toast({ title: "Muse Created", description: `${name} has been added via AI.` });
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      toast({ variant: 'destructive', title: "Generation Failed" });
    }
    setMuseGenLoading(false);
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
          <p className="text-muted-foreground max-w-md">Only the primary system wallet can access this panel.</p>
        </div>
        {!config && (
          <Button onClick={handleInitialize} disabled={loading} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold px-8">
            {loading ? 'Initializing...' : 'Initialize System as Admin'}
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
          <p className="text-muted-foreground">Governance & Account Moderation</p>
        </div>
        <Badge className="bg-yellow-400 text-black px-4 py-1">Super Admin</Badge>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="muses">Muse Tools</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allUsers.length}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Genesis Wallet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">100M ULC</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Treasury Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">$12.4k USDT</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Burn Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">45k ULC</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From/To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell><Badge variant="outline">{tx.type.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">
                      <div className="flex flex-col">
                        <span>F: {tx.fromWallet.slice(0,10)}...</span>
                        <span>T: {tx.toWallet.slice(0,10)}...</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {tx.amount.toFixed(2)} {tx.currency}
                    </TableCell>
                    <TableCell className="text-right text-[10px]">{new Date(tx.timestamp).toLocaleString()}</TableCell>
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
                  <TableHead>Username</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map(u => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-bold">{u.username}</TableCell>
                    <TableCell className="text-xs font-mono">{u.walletAddress}</TableCell>
                    <TableCell>
                      {u.isFrozen ? (
                        <Badge variant="destructive">Frozen</Badge>
                      ) : (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant={u.isFrozen ? "outline" : "destructive"}
                        onClick={() => handleToggleFreeze(u.uid, !!u.isFrozen)}
                      >
                        {u.isFrozen ? <UserCheck className="w-4 h-4 mr-2" /> : <UserX className="w-4 h-4 mr-2" />}
                        {u.isFrozen ? 'Unfreeze' : 'Freeze'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="muses">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>AI Muse Generator</CardTitle>
                <CardDescription>Use Genkit to automatically craft a new Muse profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateMuse} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Muse Name</Label>
                    <Input name="museName" placeholder="e.g. Luna Moon" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input name="museCategory" placeholder="e.g. Crypto Oracle" required />
                  </div>
                  <Button type="submit" disabled={museGenLoading} className="w-full gap-2">
                    {museGenLoading ? <RefreshCw className="animate-spin w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    Generate & Seed Muse
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Button onClick={handleSeedMuses} disabled={loading} className="w-full" variant="outline">
                   Seed Default Official Muses
                 </Button>
                 <p className="text-[10px] text-muted-foreground text-center">Resets or adds the primary Isabella, Elena, and Chloe profiles.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Wallets & Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 font-mono text-xs">
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-muted-foreground">Treasury</span>
                   <span>{config?.treasury_wallet_address}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-muted-foreground">Burn Pool</span>
                   <span>{config?.burn_pool_address}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-muted-foreground">Reserve Pool</span>
                   <span>{config?.reserve_pool_address}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-muted-foreground">Internal ULC Price</span>
                   <span>${config?.internal_ulc_purchase_price} USDT</span>
                 </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

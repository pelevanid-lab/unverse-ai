"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, seedMuses, toggleUserFreeze, triggerGenesisAllocation, SYSTEM_WALLETS } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Flame, Wallet, Users, Activity, Settings, RefreshCw, Sparkles, UserX, UserCheck, PlusCircle, Zap, Image as ImageIcon } from 'lucide-react';
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
import { generateMuseImage } from '@/ai/flows/generate-muse-image-flow';
import Image from 'next/image';

export default function AdminDashboard() {
  const { user, isConnected } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [systemWallets, setSystemWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [museGenLoading, setMuseGenLoading] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<any>(null);
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
    
    const unsubLedger = onSnapshot(query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(30)), (snap) => {
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
    if (!user) return;
    setLoading(true);
    try {
      const conf = await initializeSystemConfig(user.walletAddress);
      setConfig(conf);
      setAuthorized(true);
      toast({ title: "System Initialized", description: "17-Wallet Protocol and Genesis Ledger established." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleSeedMuses = async () => {
    setLoading(true);
    try {
      await seedMuses();
      toast({ title: "Muses Seeded", description: "Official AI Muses added to /ai_muses collection." });
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
      toast({ title: "Genesis Triggered", description: "50k ULC team grant recorded in ledger." });
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

  const handleGenerateMuse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuseGenLoading(true);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('museName') as string;
    const category = formData.get('museCategory') as string;
    try {
      const profile = await generateAiMuseProfileDescriptions({ name, category });
      const imageResult = await generateMuseImage({ prompt: `Portrait of ${name}, ${category}. ${profile.personality}. 8k digital art.` });
      setGeneratedPreview({ id: name.toLowerCase().replace(/\s/g, '_'), name, category, ...profile, avatar: imageResult.imageUrl, isOfficial: true });
    } catch (e) { toast({ variant: 'destructive', title: "Generation Failed" }); }
    setMuseGenLoading(false);
  };

  const handleSaveMuse = async () => {
    if (!generatedPreview) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'ai_muses'), generatedPreview);
      toast({ title: "Muse Published" });
      setGeneratedPreview(null);
    } catch (e) { toast({ variant: 'destructive', title: "Save Failed" }); }
    setLoading(false);
  };

  if (!isConnected) return <div className="min-h-[60vh] flex items-center justify-center">Connect Wallet</div>;

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-3xl font-headline font-bold">Unauthorized</h1>
        {!config && (
          <Button onClick={handleInitialize} disabled={loading} className="bg-yellow-400 text-black">
            {loading ? 'Initializing...' : 'Initialize 17-Wallet Protocol'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <h1 className="text-4xl font-headline font-bold text-yellow-400">Admin Console</h1>
        <Badge className="bg-yellow-400 text-black">V1 Protocol Active</Badge>
      </header>

      <Tabs defaultValue="wallets" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14">
          <TabsTrigger value="wallets">System Wallets</TabsTrigger>
          <TabsTrigger value="ledger">Global Ledger</TabsTrigger>
          <TabsTrigger value="users">Moderation</TabsTrigger>
          <TabsTrigger value="studio">Muse Studio</TabsTrigger>
          <TabsTrigger value="genesis">Genesis</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemWallets.map(w => (
              <Card key={w.id} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">{w.id.replace(/_/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline">{w.balance.toLocaleString()} ULC</div>
                  <div className="text-[10px] font-mono opacity-50 truncate">{w.address}</div>
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
                  <TableHead>From/To</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell><Badge variant="outline">{tx.type}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">
                      <div className="truncate w-32">F: {tx.fromWallet}</div>
                      <div className="truncate w-32">T: {tx.toWallet}</div>
                    </TableCell>
                    <TableCell className="font-bold">{tx.amount.toFixed(2)} {tx.currency}</TableCell>
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

        <TabsContent value="studio">
           <Card className="glass-card max-w-2xl mx-auto">
             <CardHeader>
               <CardTitle>AI Muse Generator</CardTitle>
               <CardDescription>Create influencers using Genkit & Imagen.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
               <form onSubmit={handleGenerateMuse} className="space-y-4">
                  <Input name="museName" placeholder="Muse Name" required />
                  <Input name="museCategory" placeholder="Category" required />
                  <Button type="submit" disabled={museGenLoading} className="w-full">
                    {museGenLoading ? 'Generating...' : 'Generate Profile'}
                  </Button>
               </form>
               <Button onClick={handleSeedMuses} variant="outline" className="w-full">Seed Default Influencers</Button>
               {generatedPreview && (
                 <div className="p-4 border rounded-xl space-y-4">
                   <img src={generatedPreview.avatar} className="w-20 h-20 rounded-xl" />
                   <h4 className="font-bold">{generatedPreview.name}</h4>
                   <Button onClick={handleSaveMuse} className="w-full bg-green-500">Publish to /ai_muses</Button>
                 </div>
               )}
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="genesis">
           <Card className="glass-card p-10 text-center">
             <CardTitle className="text-4xl">Genesis Protocol</CardTitle>
             <CardDescription className="text-lg mt-4">Initialize the ecosystem tokens (1 Billion ULC distribution).</CardDescription>
             <Button onClick={handleGenesisAllocation} className="mt-8 bg-yellow-400 text-black h-16 px-12 text-xl rounded-2xl font-bold">
               Grant Genesis Allocation (50k Team Vesting)
             </Button>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

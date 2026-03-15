
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, seedMuses, toggleUserFreeze, triggerGenesisAllocation } from '@/lib/ledger';
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
    
    const qLedger = query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(30));
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

  const handleGenesisAllocation = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await triggerGenesisAllocation(user);
      toast({ title: "Genesis Triggered", description: "50k ULC allocated with 24-month vesting." });
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
      // 1. Generate Profile using Genkit
      const profile = await generateAiMuseProfileDescriptions({ name, category });
      
      // 2. Generate Avatar Image using Imagen
      const imagePrompt = `A high-quality professional studio portrait of an AI influencer named ${name} who is a ${category}. ${profile.personality}. High fashion, digital art style.`;
      const imageResult = await generateMuseImage({ prompt: imagePrompt });

      setGeneratedPreview({
        id: name.toLowerCase().replace(/\s/g, '_'),
        name,
        category,
        ...profile,
        avatar: imageResult.imageUrl,
        isOfficial: true
      });
      
      toast({ title: "AI Generation Complete", description: "Profile and Avatar ready for review." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Generation Failed" });
    }
    setMuseGenLoading(false);
  };

  const handleSaveMuse = async () => {
    if (!generatedPreview) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'muses'), generatedPreview);
      toast({ title: "Muse Published", description: `${generatedPreview.name} is now live.` });
      setGeneratedPreview(null);
    } catch (e) {
      toast({ variant: 'destructive', title: "Save Failed" });
    }
    setLoading(false);
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
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
          <Button onClick={handleInitialize} disabled={loading} className="bg-yellow-400 text-black hover:bg-yellow-500 font-bold px-8 rounded-full h-12">
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
        <Badge className="bg-yellow-400 text-black px-4 py-1 uppercase tracking-tighter font-bold">Super Admin Mode</Badge>
      </header>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14 border border-white/5">
          <TabsTrigger value="overview" className="rounded-xl px-6">Overview</TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-xl px-6">Global Ledger</TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl px-6">User Base</TabsTrigger>
          <TabsTrigger value="muses" className="rounded-xl px-6">Muse Studio</TabsTrigger>
          <TabsTrigger value="genesis" className="rounded-xl px-6">Genesis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-headline">{allUsers.length}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Genesis Wallet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-headline text-yellow-400">100M ULC</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-headline text-green-400">{recentLedger.length} TXs</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-headline text-blue-400">OPTIMAL</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="glass-card overflow-hidden rounded-2xl border-white/5">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From/To</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id} className="hover:bg-white/5">
                    <TableCell><Badge variant="outline" className="text-[10px] whitespace-nowrap bg-muted/20 border-white/5">{tx.type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">
                      <div className="flex flex-col gap-1">
                        <span className="truncate max-w-[150px] opacity-60">F: {tx.fromWallet}</span>
                        <span className="truncate max-w-[150px] font-bold">T: {tx.toWallet}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">
                      {tx.amount.toFixed(2)} <span className="text-[10px] text-muted-foreground">{tx.currency}</span>
                    </TableCell>
                    <TableCell className="text-right text-[10px] text-muted-foreground">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="glass-card rounded-2xl border-white/5 overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map(u => (
                  <TableRow key={u.uid} className="hover:bg-white/5">
                    <TableCell className="font-bold flex items-center gap-2">
                      <Image src={u.avatar} alt="" width={24} height={24} className="rounded-full" />
                      {u.username}
                    </TableCell>
                    <TableCell className="text-xs font-mono opacity-50">{u.walletAddress.slice(0,12)}...</TableCell>
                    <TableCell className="text-xs font-bold">{u.ulcBalance.available.toFixed(1)} ULC</TableCell>
                    <TableCell>
                      {u.isFrozen ? (
                        <Badge variant="destructive" className="animate-pulse">Frozen</Badge>
                      ) : (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant={u.isFrozen ? "outline" : "destructive"}
                        onClick={() => handleToggleFreeze(u.uid, !!u.isFrozen)}
                        className="rounded-xl h-8 px-4"
                      >
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
            <Card className="glass-card rounded-3xl border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI Muse Studio</CardTitle>
                <CardDescription>Use Genkit (LLM) and Imagen (Visual) to create a platform influencer.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateMuse} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Muse Name</Label>
                    <Input name="museName" placeholder="e.g. Nova Silver" required className="bg-muted/30 border-none h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest opacity-60">Category / Theme</Label>
                    <Input name="museCategory" placeholder="e.g. Metaverse Architect" required className="bg-muted/30 border-none h-12" />
                  </div>
                  <Button type="submit" disabled={museGenLoading} className="w-full h-14 rounded-2xl gap-2 font-bold bg-primary hover:bg-primary/90">
                    {museGenLoading ? <RefreshCw className="animate-spin w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    Generate Full AI Profile
                  </Button>
                </form>

                {generatedPreview && (
                  <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-primary/20 space-y-4 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary">
                        <Image src={generatedPreview.avatar} alt="Avatar" fill className="object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xl">{generatedPreview.name}</h4>
                        <Badge>{generatedPreview.category}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground"><span className="font-bold text-primary">Personality:</span> {generatedPreview.personality}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-bold text-primary">Tone:</span> {generatedPreview.tone}</p>
                    </div>
                    <Button onClick={handleSaveMuse} disabled={loading} className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 font-bold">
                      Publish Official Muse
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card rounded-3xl border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-muted-foreground" /> System Seed Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="p-6 bg-muted/20 rounded-2xl border border-white/5 space-y-4">
                    <p className="text-sm text-muted-foreground">Reset or seed the initial platform Influencers (Isabella, Elena, Chloe).</p>
                    <Button onClick={handleSeedMuses} disabled={loading} className="w-full h-12 rounded-xl" variant="outline">
                      Seed Default Muses
                    </Button>
                 </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="genesis">
          <Card className="glass-card rounded-3xl border-white/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 blur-[100px] -z-10" />
            <CardHeader className="p-10">
              <CardTitle className="text-3xl font-headline font-bold flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-400" /> Genesis Allocation Tool
              </CardTitle>
              <CardDescription className="text-lg">Grant test allocations to bootstrap the ecosystem.</CardDescription>
            </CardHeader>
            <CardContent className="px-10 pb-10 space-y-8">
               <div className="bg-yellow-400/10 border border-yellow-400/20 p-6 rounded-2xl text-yellow-400">
                 <h4 className="font-bold mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Administrative Protocol</h4>
                 <p className="text-sm">This tool creates a 24-month linear vesting schedule. Use this to simulate institutional or team-based token locks.</p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                   <Label className="font-bold uppercase tracking-widest text-xs opacity-60">Grant Recipient</Label>
                   <div className="p-4 bg-muted/50 rounded-2xl border border-white/5 font-mono text-xs">
                     {user?.walletAddress}
                   </div>
                 </div>
                 <div className="space-y-4">
                   <Label className="font-bold uppercase tracking-widest text-xs opacity-60">Allocation Size</Label>
                   <div className="p-4 bg-muted/50 rounded-2xl border border-white/5 font-bold text-xl">
                     50,000 ULC
                   </div>
                 </div>
               </div>

               <Button onClick={handleGenesisAllocation} disabled={loading} className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold h-16 text-xl rounded-2xl shadow-xl shadow-yellow-400/10">
                 {loading ? <RefreshCw className="animate-spin mr-2" /> : <Zap className="mr-2" />}
                 Grant Genesis Allocation
               </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

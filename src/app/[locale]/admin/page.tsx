
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, syncSystemConfigAction, toggleUserFreeze, triggerGenesisAllocation, getAllVestingSchedules, createVestingScheduleAction, sealEconomyAction } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Users, Settings, PlusCircle, UserCheck, UserX, Loader2, Wallet, Check, X as CloseIcon, Upload, Sparkles, Lock as LockIcon, Shield, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, UserProfile, SystemConfig, ClaimRequest, VestingSchedule } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const { user, isConnected, walletAddress } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [vestingSchedules, setVestingSchedules] = useState<VestingSchedule[]>([]);
  const [loading, setLoading] = useState<string | boolean>(false);
  const [editConfig, setEditConfig] = useState<{ cost: number, treasury: number, burn: number }>({ cost: 3, treasury: 7, burn: 3 });
  const { toast } = useToast();

  useEffect(() => {
    if (!walletAddress) return;

    const unsubConfig = onSnapshot(doc(db, 'config', 'system'), (snap) => {
      const conf = snap.exists() ? (snap.data() as SystemConfig) : null;
      if (conf) {
        setConfig(conf);
        setEditConfig({
          cost: conf.ai_generation_cost || 3,
          treasury: conf.ai_generation_treasury_split || 7,
          burn: conf.ai_generation_burn_split || 3
        });
      }
      if (conf && conf.admin_wallet_address && walletAddress &&
          conf.admin_wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    });

    const unsubStats = onSnapshot(doc(db, 'config', 'stats'), (snap) => {
      if (snap.exists()) {
        const stats = snap.data();
        setStats(stats);
      }
    });

    return () => { unsubConfig(); unsubStats(); };
  }, [walletAddress]);

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!authorized) return;
    
    const unsubLedger = onSnapshot(query(collection(db, 'ledger'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      setRecentLedger(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const unsubClaims = onSnapshot(query(collection(db, 'claim_requests'), orderBy('requestedAt', 'desc')), (snap) => {
      setClaims(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClaimRequest)));
    });

    getAllVestingSchedules().then(setVestingSchedules);

    return () => { unsubLedger(); unsubUsers(); unsubClaims(); };
  }, [authorized]);

  const handleUpdateClaim = async (claimId: string, status: 'approved' | 'completed' | 'rejected') => {
    setLoading(`claim-${claimId}`);
    try {
        await updateDoc(doc(db, 'claim_requests', claimId), { status });
        toast({ title: `Claim ${status.toUpperCase()}` });
    } catch (e) {
        toast({ variant: 'destructive', title: "Update Failed" });
    } finally {
        setLoading(false);
    }
  };

  const handleInitialize = async () => {
    setLoading('init');
    try {
      await syncSystemConfigAction();
      toast({ title: "System Configuration Synced & Verified" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleSeal = async () => {
    setLoading('seal');
    try {
        await sealEconomyAction();
        toast({ title: "Economy Sealed Forever" });
    } catch (e: any) {
        toast({ variant: "destructive", title: "Sealing Failed", description: e.message });
    }
    setLoading(false);
  };



  const handleUpdateAiConfig = async () => {
    setLoading('ai-config');
    try {
        await updateDoc(doc(db, 'config', 'system'), {
            ai_generation_cost: editConfig.cost,
            ai_generation_treasury_split: editConfig.treasury,
            ai_generation_burn_split: editConfig.burn
        });
        toast({ title: "AI Configuration Updated" });
    } catch (e: any) {
        toast({ variant: "destructive", title: "Update Failed", description: e.message });
    }
    setLoading(false);
  };

  const handleGenesisAllocation = async () => {
    if (!user) return;
    setLoading('genesis');
    try {
      await triggerGenesisAllocation(user);
      toast({ title: "Allocation Complete", description: "50k ULC assigned." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Allocation Failed", description: e.message });
    }
    setLoading(false);
  };

  if (!isConnected) return <div className="min-h-[60vh] flex items-center justify-center">Connect Wallet to Continue</div>;

  if (!authorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-3xl font-headline font-bold">Unauthorized Access</h1>
        <p className="text-muted-foreground max-w-sm">Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-headline font-bold text-yellow-400">Admin Console</h1>
            <p className="text-[10px] font-mono opacity-50 mt-1">Status: Master Key Active</p>
        </div>
        <Badge className="bg-yellow-400 text-black font-bold">PROD-ACCESS</Badge>
      </header>

      <Tabs defaultValue="claims" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 mb-8">
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="staking">Staking</TabsTrigger>
          <TabsTrigger value="vesting">Vesting</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="staking">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Staking Logic & Pool Control</CardTitle>
              <CardDescription>Monitor staking volume and reward pool accumulation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm font-bold text-blue-400 uppercase">Total Staked ULC</p>
                    <p className="text-3xl font-headline font-bold">{(config?.totalStakedULC || 0).toLocaleString()} ULC</p>
                 </div>
                 <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-sm font-bold text-purple-400 uppercase">Reward Pool Conversion</p>
                    <p className="text-3xl font-headline font-bold">~{((config?.totalBuybackStakingUSDT || 0) * 100).toLocaleString()} ULC</p>
                    <p className="text-xs opacity-70">Estimated from ${(config?.totalBuybackStakingUSDT || 0).toFixed(2)} USDT</p>
                 </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold font-headline">Recent Staking Activity</h3>
                <div className="rounded-md border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white/5">
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentLedger.filter(l => l.type === 'staking_deposit' || l.type === 'staking_withdraw' || l.type === 'staking_reward').slice(0, 10).map((l) => (
                        <TableRow key={l.id} className="hover:bg-white/5 transition-colors">
                          <TableCell className="font-mono text-xs">{l.userId?.slice(0, 10)}...</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={l.type === 'staking_deposit' ? 'text-blue-400 border-blue-400/50' : l.type === 'staking_withdraw' ? 'text-red-400 border-red-400/50' : 'text-green-400 border-green-400/50'}>
                              {l.type.replace('staking_', '').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{l.amount.toLocaleString()} {l.currency}</TableCell>
                          <TableCell className="text-xs opacity-70">{new Date(l.timestamp).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vesting" className="space-y-6">
            <UsdtDashboard config={config} users={allUsers} />
            <UlcDashboard stats={stats} />
            <PoolBalances config={config} />
            <VestingManager 
                users={allUsers} 
                schedules={vestingSchedules} 
                onRefresh={() => getAllVestingSchedules().then(setVestingSchedules)}
            />
        </TabsContent>
        
        <TabsContent value="claims">
            <Card className="glass-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Requested At</TableHead>
                            <TableHead>Creator</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Network</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {claims.map(claim => (
                            <TableRow key={claim.id}>
                                <TableCell className='text-xs opacity-60 font-mono'>{new Date(claim.requestedAt).toLocaleString()}</TableCell>
                                <TableCell className='font-mono text-xs'>{claim.creatorId.slice(0, 10)}...</TableCell>
                                <TableCell className='font-bold text-green-400'>{claim.amount.toFixed(2)} {claim.currency}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px]">{claim.network}</Badge></TableCell>
                                <TableCell>
                                    <Badge className={
                                        claim.status === 'pending' ? 'bg-orange-500/20 text-orange-400' :
                                        claim.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                        'bg-muted text-muted-foreground'
                                    }>{claim.status.toUpperCase()}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {claim.status === 'pending' && (
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" onClick={() => handleUpdateClaim(claim.id, 'completed')} className="bg-green-600 hover:bg-green-700 h-8 rounded-lg">
                                                <Check className="w-4 h-4 mr-1"/> Paid
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleUpdateClaim(claim.id, 'rejected')} className="h-8 rounded-lg">
                                                <CloseIcon className="w-4 h-4"/>
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="glass-card overflow-hidden">
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
                    <TableCell className="font-bold">{u.username || u.walletAddress?.slice(0, 8)}</TableCell>
                    <TableCell>{u.ulcBalance?.available.toFixed(1) || 0} ULC</TableCell>
                    <TableCell>{u.isFrozen ? <Badge variant="destructive">Frozen</Badge> : <Badge className="bg-green-500">Active</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={u.isFrozen ? "outline" : "destructive"} onClick={() => toggleUserFreeze(u.uid, !u.isFrozen)}>
                        {u.isFrozen ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLedger.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell><Badge variant="secondary" className="text-[9px] uppercase">{tx.type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="font-mono text-[10px] opacity-60 truncate max-w-[200px]">
                        {tx.fromUserId ? `From: ${tx.fromUserId.slice(0,6)}` : tx.fromWallet ? `FW: ${tx.fromWallet.slice(0,6)}` : ''}
                        {tx.toUserId ? ` To: ${tx.toUserId.slice(0,6)}` : tx.toWallet ? ` TW: ${tx.toWallet.slice(0,6)}` : ''}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">{tx.amount.toFixed(2)} {tx.currency}</TableCell>
                    <TableCell className="text-right text-[10px] opacity-50">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="space-y-6">
           <Card className="glass-card border-green-500/50">
             <CardHeader>
               <CardTitle>System Initialization</CardTitle>
               <CardDescription>
                 {config?.isSealed ? "The token economy is now immutable." : "Establish the token economy and wallets. This is a one-time operation."}
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {!config?.isSealed ? (
                  <>
                    <Button onClick={handleInitialize} disabled={loading === 'init'} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold">
                      {loading === 'init' ? <Loader2 className="animate-spin"/> : 'Sync & Align System Configuration'}
                    </Button>
                    
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-[10px] text-red-400 mb-3 uppercase font-bold text-center">
                          Investor Safeguard (Immutable Lock)
                        </p>
                        <Button 
                          onClick={() => {
                            if(window.confirm("ARE YOU SURE? This will PERMANENTLY lock the tokenomics (Pools, Cliff, Vesting Presets). This action is IRREVERSIBLE.")) {
                              handleSeal();
                            }
                          }} 
                          disabled={loading === 'seal'} 
                          className="w-full h-10 bg-red-600 hover:bg-red-700 text-white font-bold"
                        >
                          {loading === 'seal' ? <Loader2 className="animate-spin"/> : 'SEAL ECONOMY (LOCK FOREVER)'}
                        </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center p-8 bg-green-500/20 rounded-xl border border-green-500/50">
                    <div className="text-center">
                        <LockIcon className="w-12 h-12 text-green-400 mx-auto mb-2" />
                        <h3 className="text-xl font-headline font-bold text-green-400 uppercase tracking-widest">Economy Sealed</h3>
                        <p className="text-[10px] opacity-70">Tokenomics parameters are now permanently locked in code.</p>
                    </div>
                  </div>
                )}
             </CardContent>
           </Card>

           <Card className="glass-card border-yellow-500/50">
             <CardHeader>
               <CardTitle>Management Tools</CardTitle>
               <CardDescription>Personal grants and initial content seeding.</CardDescription>
             </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={handleGenesisAllocation} disabled={!!loading} className="w-full h-12 bg-yellow-400 text-black font-bold gap-2">
                   {loading === 'genesis' ? <Loader2 className="animate-spin"/> : <><Sparkles className="w-4 h-4"/> Claim Admin Allocation (50k ULC)</>}
                </Button>
             </CardContent>
           </Card>

           <Card className="glass-card border-blue-500/50">
             <CardHeader>
               <CardTitle>AI Production Settings</CardTitle>
               <CardDescription>Configure generation costs and payment splits (Treasury vs Burn).</CardDescription>
             </CardHeader>
             <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold opacity-50 uppercase">Base Cost (ULC)</label>
                        <input 
                            type="number" 
                            value={editConfig.cost} 
                            onChange={(e) => setEditConfig({...editConfig, cost: Number(e.target.value)})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold opacity-50 uppercase">Treasury Split</label>
                        <input 
                            type="number" 
                            value={editConfig.treasury} 
                            onChange={(e) => setEditConfig({...editConfig, treasury: Number(e.target.value)})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold opacity-50 uppercase">Burn Split</label>
                        <input 
                            type="number" 
                            value={editConfig.burn} 
                            onChange={(e) => setEditConfig({...editConfig, burn: Number(e.target.value)})}
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"
                        />
                    </div>
                </div>
                
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-blue-400">
                        Current Ratio: {((editConfig.treasury / (editConfig.treasury + editConfig.burn)) * 100).toFixed(0)}% Treasury / {((editConfig.burn / (editConfig.treasury + editConfig.burn)) * 100).toFixed(0)}% Burn
                    </p>
                </div>

                <Button 
                    onClick={handleUpdateAiConfig} 
                    disabled={loading === 'ai-config'} 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                    {loading === 'ai-config' ? <Loader2 className="animate-spin"/> : 'Update AI Configuration'}
                </Button>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PoolBalances({ config }: { config: SystemConfig | null }) {
    const pools = config?.pools || {};
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(pools).map(([id, balance]) => (
                <Card key={id} className="glass-card p-3 border-white/5 bg-white/2">
                    <p className="text-[10px] uppercase font-bold opacity-50 truncate">{id.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-headline font-bold text-yellow-400">{(balance / 1000000).toFixed(1)}M</p>
                </Card>
            ))}
        </div>
    );
}

function UsdtDashboard({ config, users }: { config: SystemConfig | null, users: UserProfile[] }) {
    const totalCreatorClaims = users.reduce((sum, u) => sum + (u.usdtBalance?.available || 0), 0);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card p-4 border-green-500/20 bg-green-500/5">
                <p className="text-xs font-bold opacity-70 uppercase">Treasury USDT</p>
                <h3 className="text-2xl font-headline font-bold text-green-400">${(config?.totalTreasuryUSDT || 0).toFixed(2)}</h3>
            </Card>
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase text-blue-400">Staking Reward (USDT)</CardTitle>
                <Coins className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline text-blue-500">${(config?.totalBuybackStakingUSDT || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
            <Card className="glass-card p-4 border-blue-500/20 bg-blue-500/5">
                <p className="text-xs font-bold opacity-70 uppercase">Creator Claims (USDT)</p>
                <h3 className="text-2xl font-headline font-bold text-blue-400">${totalCreatorClaims.toFixed(2)}</h3>
            </Card>
        </div>
    );
}

function UlcDashboard({ stats }: { stats: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-card p-4 border-yellow-500/20 bg-yellow-500/5">
                <p className="text-xs font-bold opacity-70 uppercase">Treasury ULC</p>
                <h3 className="text-2xl font-headline font-bold text-yellow-500">{(stats?.totalTreasuryULC || 0).toLocaleString()} ULC</h3>
            </Card>
            <Card className="glass-card p-4 border-red-500/20 bg-red-500/5">
                <p className="text-xs font-bold opacity-70 uppercase text-red-400">Total Burned ULC</p>
                <h3 className="text-2xl font-headline font-bold text-red-500">{(stats?.totalBurnedULC || 0).toLocaleString()} ULC</h3>
            </Card>
        </div>
    );
}

const VESTING_PRESETS: Record<string, { cliffMonths: number; durationMonths: number }> = {
    reserve: { cliffMonths: 6, durationMonths: 48 },
    team: { cliffMonths: 12, durationMonths: 48 },
    creators: { cliffMonths: 0, durationMonths: 24 },
    presale: { cliffMonths: 1, durationMonths: 12 },
    liquidity: { cliffMonths: 0, durationMonths: 0 },
    exchanges: { cliffMonths: 0, durationMonths: 0 }
};

function VestingManager({ users, schedules, onRefresh }: { users: UserProfile[], schedules: VestingSchedule[], onRefresh: () => void }) {
    const [targetUserId, setTargetUserId] = useState('');
    const [amount, setAmount] = useState(1000);
    const [duration, setDuration] = useState(12);
    const [cliff, setCliff] = useState(0);
    const [desc, setDesc] = useState('');
    const [poolId, setPoolId] = useState('reserve');
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    // Auto-fill logic
    useEffect(() => {
        if (poolId !== 'promo') {
            const preset = VESTING_PRESETS[poolId];
            if (preset) {
                setDuration(preset.durationMonths);
                setCliff(preset.cliffMonths);
            }
        }
    }, [poolId]);

    const handleCreate = async () => {
        if (!targetUserId) return;
        setSubmitting(true);
        try {
            await createVestingScheduleAction({
                targetUserId,
                totalAmount: amount,
                durationMonths: duration,
                cliffMonths: cliff,
                description: desc,
                poolId: poolId
            });
            toast({ title: "Vesting Schedule Created" });
            onRefresh();
            setTargetUserId('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Creation Failed", description: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="glass-card lg:col-span-1">
                <CardHeader>
                    <CardTitle>Create Vesting</CardTitle>
                    <CardDescription>Lock tokens for a user with linear release.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase">Target User</label>
                        <select 
                            value={targetUserId} 
                            onChange={(e) => setTargetUserId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"
                        >
                            <option value="">Select a user...</option>
                            {users.map(u => (
                                <option key={u.uid} value={u.uid}>{u.username || u.uid.slice(0,8)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase">Source Pool</label>
                        <select 
                            value={poolId} 
                            onChange={(e) => setPoolId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"
                        >
                            <option value="reserve">Reserve Pool (420M)</option>
                            <option value="team">Team Vesting (130M)</option>
                            <option value="creators">Creator Incentives (120M)</option>
                            <option value="presale">Presale (100M)</option>
                            <option value="liquidity">Liquidity (60M)</option>
                            <option value="promo">Promo Pool (50M)</option>
                            <option value="exchanges">Exchanges (40M)</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-50 uppercase">Amount (ULC)</label>
                            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-50 uppercase">Duration (Months)</label>
                            <input 
                                type="number" 
                                value={duration} 
                                disabled={poolId !== 'promo'}
                                onChange={(e) => setDuration(Number(e.target.value))} 
                                className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase">Cliff (Months)</label>
                        <input 
                            type="number" 
                            value={cliff} 
                            disabled={poolId !== 'promo'}
                            onChange={(e) => setCliff(Number(e.target.value))} 
                            className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase">Description</label>
                        <input type="text" value={desc} placeholder="e.g. Team Allocation" onChange={(e) => setDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"/>
                    </div>
                    <Button onClick={handleCreate} disabled={submitting || !targetUserId} className="w-full bg-yellow-400 text-black font-bold h-12">
                        {submitting ? <Loader2 className="animate-spin"/> : 'Create Schedule'}
                    </Button>
                </CardContent>
            </Card>

            <Card className="glass-card lg:col-span-2 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Released</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Start Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {schedules.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-mono text-[10px]">{s.userId.slice(0,8)}...</TableCell>
                                <TableCell className="font-bold">{s.totalAmount} ULC</TableCell>
                                <TableCell className="text-green-400">{s.releasedAmount.toFixed(1)}</TableCell>
                                <TableCell>{s.duration / (30*24*60*60*1000)}m</TableCell>
                                <TableCell className="text-[10px] opacity-60">{new Date(s.startTime).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}


"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { getSystemConfig, initializeSystemConfig, toggleUserFreeze, triggerGenesisAllocation, getAllVestingSchedules, createVestingScheduleAction } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Database, Coins, Users, Settings, PlusCircle, UserCheck, UserX, Loader2, Wallet, Check, X as CloseIcon, Upload, Sparkles } from 'lucide-react';
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
      await initializeSystemConfig();
      toast({ title: "System Initialized" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
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
        <TabsList className="bg-muted/30 p-1 rounded-2xl h-14">
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="vesting">Vesting</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="vesting">
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
               <CardDescription>Establish the token economy and wallets. This is a one-time operation.</CardDescription>
             </CardHeader>
             <CardContent>
                <Button onClick={handleInitialize} disabled={loading === 'init'} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold">
                  {loading === 'init' ? <Loader2 className="animate-spin"/> : 'Initialize System Economy'}
                </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VestingManager({ users, schedules, onRefresh }: { users: UserProfile[], schedules: VestingSchedule[], onRefresh: () => void }) {
    const [targetUserId, setTargetUserId] = useState('');
    const [amount, setAmount] = useState(1000);
    const [duration, setDuration] = useState(12);
    const [cliff, setCliff] = useState(0);
    const [desc, setDesc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    const handleCreate = async () => {
        if (!targetUserId) return;
        setSubmitting(true);
        try {
            await createVestingScheduleAction({
                targetUserId,
                totalAmount: amount,
                durationMonths: duration,
                cliffMonths: cliff,
                description: desc
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-50 uppercase">Amount (ULC)</label>
                            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold opacity-50 uppercase">Duration (Months)</label>
                            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"/>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold opacity-50 uppercase">Cliff (Months)</label>
                        <input type="number" value={cliff} onChange={(e) => setCliff(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-lg h-10 px-3 text-sm"/>
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

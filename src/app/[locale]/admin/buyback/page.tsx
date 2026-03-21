"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { SystemConfig, LedgerEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, 
  TrendingDown, 
  Wallet, 
  Lock, 
  Rocket, 
  Droplets, 
  ArrowRight,
  TrendingUp,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
  Coins
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { executeBuybackAction } from '@/lib/ledger';

export default function BuybackDashboard() {
  const { isConnected, walletAddress } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const { toast } = useToast();

  // Financial Inputs
  const [opCost, setOpCost] = useState<number>(0);
  const [manualUSDT, setManualUSDT] = useState<number>(0);
  const [buybackRatio, setBuybackRatio] = useState<number>(30); // 30% default

  useEffect(() => {
    if (!walletAddress) return;

    const unsubConfig = onSnapshot(doc(db, 'config', 'system'), (snap) => {
      const conf = snap.exists() ? (snap.data() as SystemConfig) : null;
      if (conf) {
        setConfig(conf);
        setOpCost(conf.operationCostUSDT || 0);
        setManualUSDT(conf.treasuryUSDTBalanceManual || 0);
        setBuybackRatio((conf.treasury_buyback_ratio || 0.3) * 100);
        
        if (conf.admin_wallet_address?.toLowerCase() === walletAddress?.toLowerCase()) {
          setAuthorized(true);
        }
      }
    });

    const unsubHistory = onSnapshot(
      query(
        collection(db, 'ledger'), 
        where('type', '==', 'buyback_burn'), 
        orderBy('timestamp', 'desc'), 
        limit(20)
      ), 
      (snap) => {
        setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry)));
      }
    );

    return () => { unsubConfig(); unsubHistory(); };
  }, [walletAddress]);

  // Calculations
  const grossRevenue = (config?.totalTreasuryUSDT || 0) + manualUSDT;
  const netRevenue = Math.max(0, grossRevenue - opCost);
  const buybackBudget = netRevenue * (buybackRatio / 100);

  const isReady = config?.presaleCompleted && config?.tokenLaunchCompleted && config?.marketLiquidityReady;

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'config', 'system'), {
        operationCostUSDT: opCost,
        treasuryUSDTBalanceManual: manualUSDT,
        treasury_buyback_ratio: buybackRatio / 100
      });
      toast({ title: "Settings Updated" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGate = async (gate: 'presaleCompleted' | 'tokenLaunchCompleted' | 'marketLiquidityReady', value: boolean) => {
    try {
      await updateDoc(doc(db, 'config', 'system'), { [gate]: value });
      toast({ title: "Gate Updated" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed" });
    }
  };

  const handleExecuteBuyback = async () => {
    if (!isReady) {
      toast({ variant: 'destructive', title: "Gated Action", description: "All launch conditions must be met." });
      return;
    }
    if (buybackBudget <= 0) {
      toast({ variant: 'destructive', title: "No Budget", description: "Buyback budget must be positive." });
      return;
    }

    if (!confirm(`Are you sure you want to execute buyback for $${buybackBudget.toFixed(2)} USDT?`)) return;

    setLoading(true);
    try {
      await executeBuybackAction({
        amountUSDT: buybackBudget,
        description: `Strategic Buyback - Net Profit Allocation (${buybackRatio}%)`
      });
      toast({ title: "Buyback Executed", description: "Tokens purchased and burned." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Execution Failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) return <div className="p-20 text-center">Connect Wallet</div>;
  if (!authorized) return <div className="p-20 text-center text-destructive">Unauthorized</div>;

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-6xl">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-headline font-bold text-yellow-400">Buyback Mission Control</h1>
          <p className="text-muted-foreground">Manage post-launch deflationary operations.</p>
        </div>
        <div className="flex gap-4">
           {isReady ? (
             <Badge className="bg-green-500/20 text-green-400 border-green-500/50 flex gap-1 px-3 py-1">
               <CheckCircle2 className="w-4 h-4" /> Ready for Operations
             </Badge>
           ) : (
             <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50 flex gap-1 px-3 py-1">
               <AlertCircle className="w-4 h-4" /> Launch Gated
             </Badge>
           )}
        </div>
      </header>

      {/* Launch Gates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GateCard 
          title="Presale Phase" 
          icon={<Lock className="w-6 h-6" />} 
          active={config?.presaleCompleted} 
          onToggle={(v: boolean) => handleToggleGate('presaleCompleted', v)}
        />
        <GateCard 
          title="Token Launch" 
          icon={<Rocket className="w-6 h-6" />} 
          active={config?.tokenLaunchCompleted} 
          onToggle={(v: boolean) => handleToggleGate('tokenLaunchCompleted', v)}
        />
        <GateCard 
          title="Market Liquidity" 
          icon={<Droplets className="w-6 h-6" />} 
          active={config?.marketLiquidityReady} 
          onToggle={(v: boolean) => handleToggleGate('marketLiquidityReady', v)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Financial Controls */}
        <Card className="glass-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-yellow-400" />
              Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Manual Treasury USDT (Off-chain Rev)</Label>
              <Input 
                type="number" 
                value={manualUSDT} 
                onChange={(e) => setManualUSDT(Number(e.target.value))} 
                className="bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label>Operation Costs (Monthly USDT)</Label>
              <Input 
                type="number" 
                value={opCost} 
                onChange={(e) => setOpCost(Number(e.target.value))} 
                className="bg-black/40"
              />
            </div>
            <div className="space-y-2">
              <Label>Buyback Allocation % ({buybackRatio}%)</Label>
              <Input 
                type="range" 
                min="0" 
                max="100" 
                value={buybackRatio} 
                onChange={(e) => setBuybackRatio(Number(e.target.value))} 
              />
            </div>
            <Button 
                onClick={handleUpdateSettings} 
                className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold"
                disabled={loading}
            >
                {loading ? "Saving..." : "Update Parameters"}
            </Button>
          </CardContent>
        </Card>

        {/* Dashboard / Action */}
        <Card className="glass-card lg:col-span-2 overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <TrendingDown className="w-48 h-48" />
           </div>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Real-time buyback eligibility based on net revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatItem label="Gross Revenue" value={grossRevenue} icon={<Wallet className="text-blue-400" />} />
              <StatItem label="Op Costs" value={opCost} icon={<TrendingUp className="text-red-400" />} negative />
              <StatItem label="Net Profit" value={netRevenue} icon={<TrendingDown className="text-green-400" />} />
              <StatItem label="Buyback Pwr" value={buybackBudget} icon={<Coins className="text-yellow-400" />} highlight />
            </div>

            <div className="p-6 rounded-xl bg-yellow-400/5 border border-yellow-400/20 space-y-4">
               <div className="flex justify-between items-center">
                  <h3 className="font-headline font-bold text-xl">System Execution</h3>
                  <Badge variant="outline" className="border-yellow-400/50 text-yellow-400 uppercase text-[10px]">Manual Trigger</Badge>
               </div>
               <p className="text-sm text-muted-foreground">
                  Executing buyback will convert available Treasury USDT into ULC on the market (simulated) and move it to the Burn Pool permanently.
               </p>
               <Button 
                  size="lg" 
                  className={`w-full font-bold h-14 ${isReady ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-muted opacity-50 cursor-not-allowed'}`}
                  disabled={!isReady || loading || buybackBudget <= 0}
                  onClick={handleExecuteBuyback}
               >
                  {loading ? "Processing..." : isReady ? `EXECUTE $${buybackBudget.toFixed(2)} BUYBACK (~${Math.floor(buybackBudget / (config?.listingPriceUSDT || 0.015)).toLocaleString()} ULC)` : "LAUNCH GATED"}
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Burn History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead className="text-right">USDT Amount</TableHead>
                  <TableHead className="text-right">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length > 0 ? history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-yellow-400">{entry.description || "System Buyback"}</TableCell>
                    <TableCell className="text-right font-mono">${entry.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right opacity-50 text-[10px]">{entry.id}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No buyback events recorded yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatItem({ label, value, icon, negative = false, highlight = false }: any) {
  return (
    <div className={`p-4 rounded-lg bg-white/5 border border-white/10 ${highlight ? 'ring-1 ring-yellow-400/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase opacity-50">{label}</span>
        {icon}
      </div>
      <p className={`text-xl font-headline font-bold ${negative ? 'text-red-400' : highlight ? 'text-yellow-400' : ''}`}>
        {negative ? '-' : ''}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function GateCard({ title, icon, active, onToggle }: any) {
  return (
    <Card className={`transition-all duration-300 ${active ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className={`p-3 rounded-lg ${active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {icon}
           </div>
           <div>
              <p className="text-sm font-bold uppercase opacity-50 leading-none mb-1">Status</p>
              <h3 className="font-headline font-bold text-lg">{title}</h3>
           </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className={active ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}
          onClick={() => onToggle(!active)}
        >
          {active ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
          {active ? 'Completed' : 'Pending'}
        </Button>
      </CardContent>
    </Card>
  );
}

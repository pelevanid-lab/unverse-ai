
"use client"

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { AnimatedText } from '@/components/landing/AnimatedText';
import { 
    ArrowRight, Zap, Coins, Flame, Gem, TrendingUp, 
    Lock, Shield, BarChart3, ChevronRight, Info,
    DollarSign, Loader2, ArrowRightLeft, Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { getSystemConfig, confirmPresalePurchase } from '@/lib/ledger';
import { SystemConfig } from '@/lib/types';

const PRESALE_PRICE = 0.01;
const DEX_LISTING_PRICE = 0.015;
const TOTAL_PRESALE_ALLOCATION = 100000000; // 100M

export default function TokenomicsPage() {
  const { isConnected, connectWallet, user } = useWallet();
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  
  // Presale States
  const [usdtAmount, setUsdtAmount] = useState(10);
  const [ulcAmount, setUlcAmount] = useState(1000);
  const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    getSystemConfig().then(setSystemConfig);
  }, []);

  const handleUsdtChange = (val: string) => {
    const num = Number(val);
    setUsdtAmount(num);
    setUlcAmount(num / PRESALE_PRICE);
  };

  const handlePurchase = async () => {
    if (!user || !systemConfig) {
        toast({ variant: "destructive", title: "Auth Required", description: "Connect wallet to buy." });
        return;
    }

    const treasuryWallet = systemConfig.treasury_wallets[selectedNetwork];
    setIsProcessing(true);

    try {
        let txHash: string;
        if (selectedNetwork === 'TON') {
            if (!tonConnectUI.connected) await tonConnectUI.openModal();
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{ address: treasuryWallet, amount: (usdtAmount * 1_000_000_000).toString() }]
            });
            txHash = result.boc;
        } else {
            const provider = (window as any).tronWeb;
            if (!provider) throw new Error("TronLink not found.");
            const contract = await provider.contract().at("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
            const result = await contract.transfer(treasuryWallet, (usdtAmount * 1_000_000).toString()).send();
            txHash = result;
        }

        await confirmPresalePurchase(usdtAmount, selectedNetwork, txHash);
        toast({ title: "Purchase Success!", description: `${ulcAmount.toLocaleString()} ULC locked in vesting.` });
        getSystemConfig().then(setSystemConfig);
    } catch (e: any) {
        toast({ variant: "destructive", title: "Purchase Failed", description: e.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const presaleSold = systemConfig?.totalPresaleSold || 0;
  const presaleProgress = (presaleSold / TOTAL_PRESALE_ALLOCATION) * 100;

  return (
    <div className="space-y-16 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-10 md:pt-20 text-center space-y-8 max-w-5xl mx-auto px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-primary/10 blur-[150px] rounded-full -z-10" />
        
        <h1 className="text-6xl md:text-8xl font-headline font-bold tracking-tighter leading-[0.9]">
            Unlock Your <br/>
            <span className="gradient-text">Universe.</span>
        </h1>
        
        <div className="text-3xl md:text-5xl font-headline font-bold leading-tight">
            <AnimatedText words={["Invest.", "Earn.", "Innovate."]} />
        </div>
        
        <p className="text-xs md:text-sm text-primary/60 font-bold tracking-[0.3em] uppercase">
            Powered by $ULC Utility Token
        </p>

        {/* Pre-Sale Card (Replacing Video) */}
        <div className="mt-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Card className="glass-card border-primary/30 relative overflow-hidden group shadow-2xl shadow-primary/10">
                <div className="absolute top-0 right-0 p-4">
                    <Badge className="bg-green-500 text-black font-bold animate-pulse">LIVE PRE-SALE</Badge>
                </div>
                
                <CardHeader className="text-left pb-2">
                    <CardTitle className="text-2xl font-headline font-bold text-yellow-500 flex items-center gap-2">
                        <Zap className="fill-yellow-500" /> Early Access Sale
                    </CardTitle>
                    <CardDescription>Secure $ULC before DEX listing at 33% discount.</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6 text-left">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Pre-Sale Price</p>
                            <p className="text-xl font-bold font-headline text-green-400">${PRESALE_PRICE} <span className="text-xs font-normal opacity-50">USDT</span></p>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Listing Price</p>
                            <p className="text-xl font-bold font-headline text-primary">${DEX_LISTING_PRICE} <span className="text-xs font-normal opacity-50">USDT</span></p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Tokens Sold: {presaleSold.toLocaleString()} / 100M</Label>
                            <span className="text-xs font-bold text-primary">{presaleProgress.toFixed(1)}%</span>
                        </div>
                        <Progress value={presaleProgress} className="h-2 bg-white/5" />
                    </div>

                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold">Invest Amount (USDT)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={usdtAmount}
                                        onChange={(e) => handleUsdtChange(e.target.value)}
                                        className="h-12 bg-white/5 border-white/10 font-bold pl-12"
                                    />
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-primary/70">You Receive</p>
                                <p className="text-lg font-bold font-headline">{ulcAmount.toLocaleString()} ULC</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4">
                                <div className="flex items-center space-x-2 bg-white/5 px-4 h-11 rounded-xl border border-white/5 cursor-pointer">
                                    <RadioGroupItem value="TON" id="p-ton" />
                                    <Label htmlFor="p-ton" className="cursor-pointer font-bold">TON</Label>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/5 px-4 h-11 rounded-xl border border-white/5 cursor-pointer">
                                    <RadioGroupItem value="TRON" id="p-tron" />
                                    <Label htmlFor="p-tron" className="cursor-pointer font-bold">TRON</Label>
                                </div>
                            </RadioGroup>
                            
                            <Button 
                                onClick={handlePurchase} 
                                disabled={isProcessing || !isConnected}
                                className="flex-1 h-12 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" /> : "Purchase $ULC"}
                            </Button>
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground italic">
                            *Auto-vesting: 12 month cliff, 24 months linear release. 
                            <Link href="/tokenomics/investors" className="underline hover:text-primary ml-1">Learn more.</Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </section>

      {/* Guide Links Section */}
      <section className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/tokenomics/investors">
            <Card className="glass-card p-8 border-yellow-500/20 hover:border-yellow-500/50 transition-all group overflow-hidden relative">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-32 h-32 text-yellow-500" />
                </div>
                <div className="space-y-4 relative z-10">
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">Institutional Deep-Dive</Badge>
                    <h3 className="text-3xl font-headline font-bold">Investor Tokenomics</h3>
                    <p className="text-muted-foreground text-sm">Explore deflationary mechanics, revenue-backed yield, and long-term scarcity models.</p>
                    <div className="flex items-center gap-2 text-yellow-500 font-bold pt-2 group-hover:translate-x-1 transition-transform">
                        Read Whitepaper <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Card>
          </Link>

          <Link href="/tokenomics/creators">
            <Card className="glass-card p-8 border-pink-500/20 hover:border-pink-500/50 transition-all group overflow-hidden relative">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles className="w-32 h-32 text-pink-500" />
                </div>
                <div className="space-y-4 relative z-10">
                    <Badge variant="outline" className="text-pink-400 border-pink-500/20">Creator Benefits</Badge>
                    <h3 className="text-3xl font-headline font-bold">Creator Guide</h3>
                    <p className="text-muted-foreground text-sm">Learn how to monetize your AI creativity with 85% revenue splits and instant payouts.</p>
                    <div className="flex items-center gap-2 text-pink-400 font-bold pt-2 group-hover:translate-x-1 transition-transform">
                        Start Earning <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </Card>
          </Link>
      </section>

      {/* Striking Data Section */}
      <section className="max-w-5xl mx-auto px-4 py-10 space-y-12">
          <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-headline font-bold">Built for Sustainability.</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Unlike generic social tokens, $ULC value is integrated into every platform interaction.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                  { 
                      icon: <Flame className="text-red-400" />, 
                      title: "Deflationary", 
                      desc: "Every AI generation (3 ULC) burns 1 ULC permanently. Every premium unlock (15%) burns 5% total.",
                      color: "border-red-500/20"
                  },
                  { 
                      icon: <Gem className="text-green-400" />, 
                      title: "Real Yield", 
                      desc: "5% of EVERY USDT subscription globally goes directly to the staking reward pool.",
                      color: "border-green-500/20"
                  },
                  { 
                      icon: <Coins className="text-blue-400" />, 
                      title: "Fair Split", 
                      desc: "Creators keep 85% of their earnings. The platform never takes more than 15%.",
                      color: "border-blue-500/20"
                  }
              ].map((item, idx) => (
                  <Card key={idx} className={`glass-card p-6 space-y-4 ${item.color}`}>
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                          {item.icon}
                      </div>
                      <h4 className="text-xl font-headline font-bold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </Card>
              ))}
          </div>

          <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-white/5 flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 blur-3xl opacity-50" />
              <div className="space-y-4 relative z-10">
                  <h3 className="text-3xl font-headline font-bold">1 Billion Cap. <br/> <span className="opacity-50">Zero Minting.</span></h3>
                  <p className="text-muted-foreground max-w-sm">The economy is sealed and immutable. Scarcity is hard-coded into the Unverse DNA.</p>
                  <Link href="/tokenomics/investors">
                    <Button variant="link" className="p-0 h-auto text-primary gap-2">
                        View Audit & Supply Details <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
              </div>
              <div className="flex gap-4 relative z-10 scale-90 sm:scale-100">
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <Lock className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">Security</p>
                      <p className="font-bold">Sealed</p>
                  </Card>
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <Shield className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">Audit</p>
                      <p className="font-bold">Verified</p>
                  </Card>
                  <Card className="glass-card p-4 text-center border-none bg-white/5">
                      <BarChart3 className="mx-auto mb-1 text-primary w-5 h-5" />
                      <p className="text-[10px] font-bold opacity-50 uppercase">Supply</p>
                      <p className="font-bold">Capped</p>
                  </Card>
              </div>
          </div>
      </section>
    </div>
  );
}

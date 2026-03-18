
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Creator, SystemConfig } from '@/lib/types';
import { confirmUlcPurchase, createClaimRequest, getSystemConfig, calculateCreatorUsdtEarnings } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, Wallet as WalletIcon, History, ExternalLink, Settings, ArrowRightLeft, ChevronLeft } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';

// --- CONSTANTS ---
const ULC_PRICE_USDT = 0.015; // 1 ULC = 0.015 USDT

// --- SUB-COMPONENTS ---

function BalanceCard({ user }: { user: UserProfile | null }) {
    let numericBalance = 0;
    const ulcBalance = user?.ulcBalance;

    if (typeof ulcBalance === 'number') {
        numericBalance = ulcBalance;
    } else if (typeof ulcBalance === 'object' && ulcBalance !== null && 'available' in ulcBalance) {
        const availableBalance = (ulcBalance as any).available;
        if (typeof availableBalance === 'number') {
            numericBalance = availableBalance;
        }
    }

    const displayBalance = isNaN(numericBalance) ? '0.00' : numericBalance.toFixed(2);

    return (
        <Card className="glass-card lg:col-span-5">
            <CardHeader>
                <CardTitle>Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-headline">{displayBalance}</span>
                    <span className="text-lg text-muted-foreground">ULC</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 text-primary/80 font-medium">Unlock Currency</p>
            </CardContent>
        </Card>
    );
}

function HistoryCardLink() {
    return (
        <Link href="/wallet/history">
            <Card className="glass-card lg:col-span-5 border-white/10 hover:border-primary/50 transition-colors cursor-pointer mt-4">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><History/> Transaction History</span>
                        <ExternalLink className="w-5 h-5 text-muted-foreground"/>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">View your complete transaction history.</p>
                </CardContent>
            </Card>
        </Link>
    )
}

function BuyUlcCard({ user, systemConfig, onPurchase }: { user: UserProfile, systemConfig: SystemConfig | null, onPurchase: (ulcAmount: number, network: 'TRON' | 'TON', usdtCost: number) => Promise<void> }) {
    const [ulcAmount, setUlcAmount] = useState<number>(1000);
    const [usdtAmount, setUsdtAmount] = useState<number>(15);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');
    const [isProcessing, setIsProcessing] = useState(false);

    // Sync amounts (1 ULC = 0.015 USDT)
    const handleUlcChange = (val: string) => {
        const num = Number(val);
        setUlcAmount(num);
        setUsdtAmount(Number((num * ULC_PRICE_USDT).toFixed(4)));
    };

    const handleUsdtChange = (val: string) => {
        const num = Number(val);
        setUsdtAmount(num);
        setUlcAmount(Number((num / ULC_PRICE_USDT).toFixed(0)));
    };

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            await onPurchase(ulcAmount, selectedNetwork, usdtAmount);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="glass-card lg:col-span-5 relative">
            <Link href="/payment-wallets" className="absolute top-4 right-4 z-10">
                <Button variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 gap-2 px-2 sm:px-4 h-9" title="Payment Wallets">
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-medium">Payment Wallets</span>
                </Button>
            </Link>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">Buy ULC</CardTitle>
                <CardDescription>
                    Purchase Unlock Currency (ULC) with USDT.
                    <br/>
                    <span className="text-primary font-bold">1 ULC = {ULC_PRICE_USDT} USDT</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                        <Label>ULC Amount</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={ulcAmount}
                                onChange={(e) => handleUlcChange(e.target.value)}
                                className="font-bold pl-12"
                                min="1"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">ULC</div>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center pb-2">
                        <ArrowRightLeft className="text-muted-foreground w-5 h-5 rotate-90 md:rotate-0" />
                    </div>
                    <div className="space-y-2">
                        <Label>USDT Cost</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                value={usdtAmount}
                                onChange={(e) => handleUsdtChange(e.target.value)}
                                className="font-bold pl-14"
                                min="0.01"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-xs font-bold">USDT</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-sm font-medium">Select Payment Network</Label>
                    <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-6">
                        <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="TON" id="ton" />
                            <Label htmlFor="ton" className="cursor-pointer font-bold">TON</Label>
                        </div>
                        <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                            <RadioGroupItem value="TRON" id="tron" />
                            <Label htmlFor="tron" className="cursor-pointer font-bold">TRON</Label>
                        </div>
                    </RadioGroup>
                </div>

                <Button onClick={handlePurchase} disabled={isProcessing || !user || !systemConfig || usdtAmount <= 0} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <DollarSign className="w-5 h-5 mr-2" />}
                    Pay {usdtAmount} USDT for {ulcAmount} ULC
                </Button>
            </CardContent>
        </Card>
    );
}

function UsdtEarningsCard({ creator, onClaim, loading, availableBalance, pendingBalance }: { creator: Creator, onClaim: () => void, loading: boolean, availableBalance: number, pendingBalance: number }) {
    return (
        <Card className="glass-card lg:col-span-5 relative border-white/10">
            <Link href="/creator/collection-wallets" className="absolute top-4 right-4 z-10">
                <Button variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 gap-2 px-2 sm:px-4 h-9" title="Collection Addresses">
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline text-xs font-medium">Collection Addresses</span>
                </Button>
            </Link>
            <CardHeader>
                <CardTitle>USDT Earnings</CardTitle>
                <CardDescription>Your earnings from subscriptions. You can claim your available balance.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                 <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Available to Claim</p>
                    <p className="text-2xl font-bold font-headline">{availableBalance.toFixed(2)} <span className="text-base font-normal text-muted-foreground">USDT</span></p>
                </div>
                <div className="space-y-1">
                     <p className="text-sm text-muted-foreground">Pending Claim</p>
                    <p className="text-2xl font-bold font-headline">{pendingBalance.toFixed(2)} <span className="text-base font-normal text-muted-foreground">USDT</span></p>
                </div>
                 <Button onClick={onClaim} disabled={loading || availableBalance <= 0} className="w-full md:w-auto">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <WalletIcon className="w-4 h-4 mr-2" />}
                    Claim Funds
                </Button>
            </CardContent>
        </Card>
    );
}


// --- MAIN WALLET PAGE ---
export default function WalletPage() {
  const router = useRouter();
  const { user, isConnected } = useWallet();
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [earnings, setEarnings] = useState<{ available: number, pending: number }>({ available: 0, pending: 0 });

  // Fetch user profile and system config
  useEffect(() => {
    getSystemConfig().then(setSystemConfig);
    if (user?.uid) {
        const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
            setUserProfile(doc.data() as UserProfile);
        });
        return () => unsub();
    } 
  }, [user, router]);

  // Fetch creator earnings
  useEffect(() => {
      if(userProfile?.isCreator && userProfile.uid) {
          calculateCreatorUsdtEarnings(userProfile.uid).then(setEarnings);
      }
  }, [userProfile]);

  const handlePurchase = async (ulcAmount: number, network: 'TRON' | 'TON', usdtCost: number) => {
    if (!user || !userProfile || !systemConfig) {
      toast({ variant: "destructive", title: "Error", description: "User profile or system config not loaded." });
      return;
    }

    const treasuryWallet = systemConfig.treasury_wallets[network];
    if (!treasuryWallet) {
         toast({ variant: "destructive", title: "Error", description: `Treasury wallet for ${network} is not configured.` });
         return;
    }

    try {
        let txHash: string;
        if (network === 'TON') {
             if (!tonConnectUI.connected) {
                await tonConnectUI.openModal();
             }
            
            const result = await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{ 
                    address: treasuryWallet, 
                    amount: (usdtCost * 1_000_000_000).toString() 
                }]
            });
            txHash = result.boc;
        } else {
             const provider = (window as any).tronWeb;
             if (!provider) throw new Error("TronLink not found. Please install TronLink.");
             
             const usdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; 
             const contract = await provider.contract().at(usdtContractAddress);
             const decimals = 6;
             const amountInSun = (usdtCost * Math.pow(10, decimals)).toString();
             
             const result = await contract.transfer(treasuryWallet, amountInSun).send();
             txHash = result;
        }
        
        await confirmUlcPurchase(userProfile, ulcAmount, network, txHash);

        toast({
            title: "Purchase Successful",
            description: `Your purchase of ${ulcAmount} ULC has been processed.`,
        });

    } catch (e: any) {
        console.error("Purchase failed", e);
        toast({
            variant: "destructive",
            title: "Purchase Failed",
            description: e.message || "An error occurred during the transaction.",
        });
    }
  };

  const handleClaim = async () => {
    if (!userProfile?.creatorData) return;
    setClaimLoading(true);
    try {
        const claimId = await createClaimRequest(userProfile.creatorData);
        toast({
            title: "Claim Request Submitted",
            description: `Your request to claim ${earnings.available.toFixed(2)} USDT is pending approval. Claim ID: ${claimId}`
        });
        calculateCreatorUsdtEarnings(userProfile.uid).then(setEarnings); // Refresh earnings
    } catch (e: any) {
         toast({
            variant: "destructive",
            title: "Claim Failed",
            description: e.message || "An error occurred.",
        });
    } finally {
        setClaimLoading(false);
    }
  };
  
  if (!isConnected || !user || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <h1 className="text-3xl font-headline font-bold">Loading Wallet...</h1>
        <p className="text-muted-foreground">Please connect your wallet to continue.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push('/mypage')} className="h-10 w-10 rounded-full bg-white/5">
                <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
                <h1 className="text-4xl font-headline font-bold gradient-text">My Wallet</h1>
                <p className="text-muted-foreground">Manage your credits and earnings.</p>
            </div>
        </header>
        
        <div className="flex flex-col gap-6">
            <BalanceCard user={userProfile} />

            {userProfile.isCreator && (
                <UsdtEarningsCard 
                    creator={userProfile.creatorData || { uid: userProfile.uid, username: userProfile.username, subscriptionPriceMonthly: 0 }} 
                    onClaim={handleClaim} 
                    loading={claimLoading}
                    availableBalance={earnings.available}
                    pendingBalance={earnings.pending}
                />
            )}

            <BuyUlcCard user={userProfile} systemConfig={systemConfig} onPurchase={handlePurchase} />

            <div className="border-t border-white/5 pt-4">
                <HistoryCardLink />
            </div>
        </div>
    </div>
  );
}

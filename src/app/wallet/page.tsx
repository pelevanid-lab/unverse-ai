
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
import { Loader2, DollarSign, Wallet as WalletIcon, History, ExternalLink, Plus } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';

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
        <Card className="glass-card lg:col-span-2">
            <CardHeader>
                <CardTitle>Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-headline">{displayBalance}</span>
                    <span className="text-lg text-muted-foreground">ULC</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Universal Loyalty Credits</p>
            </CardContent>
        </Card>
    );
}

function HistoryCardLink() {
    return (
        <Link href="/wallet/history">
            <Card className="glass-card lg:col-span-2 border-white/10 hover:border-primary/50 transition-colors cursor-pointer">
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

function BuyUlcCard({ user, systemConfig, onPurchase }: { user: UserProfile, systemConfig: SystemConfig | null, onPurchase: (amount: number, network: 'TRON' | 'TON') => Promise<void> }) {
    const [ulcAmount, setUlcAmount] = useState(100);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePurchase = async () => {
        setIsProcessing(true);
        try {
            await onPurchase(ulcAmount, selectedNetwork);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="glass-card lg:col-span-3">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus/> Buy ULC</CardTitle>
                <CardDescription>
                    Purchase Universal Loyalty Credits (ULC) with USDT.
                    <br/>
                    1 ULC = 1 USDT.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Amount of ULC to Buy</Label>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" onClick={() => setUlcAmount(p => Math.max(10, p - 10))}>-</Button>
                         <Input
                            type="number"
                            value={ulcAmount}
                            onChange={(e) => setUlcAmount(Number(e.target.value))}
                            className="w-24 text-center font-bold"
                            min="10"
                            step="10"
                        />
                        <Button variant="outline" size="sm" onClick={() => setUlcAmount(p => p + 10)}>+</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Pay with USDT on</Label>
                    <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TON" id="ton" />
                            <Label htmlFor="ton">TON Network</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TRON" id="tron" />
                            <Label htmlFor="tron">TRON Network</Label>
                        </div>
                    </RadioGroup>
                </div>

                <Button onClick={handlePurchase} disabled={isProcessing || !user || !systemConfig} className="w-full">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <DollarSign className="w-4 h-4 mr-2" />}
                    Pay {ulcAmount} USDT via {selectedNetwork}
                </Button>
            </CardContent>
        </Card>
    );
}

function UsdtEarningsCard({ creator, onClaim, loading, availableBalance, pendingBalance }: { creator: Creator, onClaim: () => void, loading: boolean, availableBalance: number, pendingBalance: number }) {
    return (
        <Card className="glass-card lg:col-span-5">
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

  const handlePurchase = async (amount: number, network: 'TRON' | 'TON') => {
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
                messages: [{ address: treasuryWallet, amount: (amount * 1_000_000).toString() }] // amount in nano-units
            });
            txHash = result.boc; // Use the BOC as a pseudo-tx hash for now
        } else {
             // Placeholder for TronWeb integration.
             // This would involve calling a function to interact with TronLink or another wallet.
             console.log(`Simulating TRON purchase of ${amount} USDT to ${treasuryWallet}`);
             txHash = `fake_tron_tx_${Date.now()}`;
        }
        
        // Confirm purchase with backend
        await confirmUlcPurchase(userProfile, amount, network, txHash);

        toast({
            title: "Purchase Successful",
            description: `Your purchase of ${amount} ULC has been processed.`,
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
    <div className="space-y-8 pb-12">
        <header>
            <h1 className="text-4xl font-headline font-bold gradient-text">My Wallet</h1>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <BalanceCard user={userProfile} />
            <HistoryCardLink />

            <div className="lg:col-span-5 border-b border-white/10"></div>

            <BuyUlcCard user={userProfile} systemConfig={systemConfig} onPurchase={handlePurchase} />

            {userProfile.isCreator && userProfile.creatorData && (
                <UsdtEarningsCard 
                    creator={userProfile.creatorData} 
                    onClaim={handleClaim} 
                    loading={claimLoading}
                    availableBalance={earnings.available}
                    pendingBalance={earnings.pending}
                />
            )}
        </div>
    </div>
  );
}

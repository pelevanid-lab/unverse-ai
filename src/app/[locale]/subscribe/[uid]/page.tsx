
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, SystemConfig } from '@/lib/types';
import { getSystemConfig, recordUsdtSubscription } from '@/lib/ledger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, ShieldCheck, Zap } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function SubscribePage() {
    const { uid } = useParams();
    const router = useRouter();
    const { user: currentUser } = useWallet();
    const [tonConnectUI] = useTonConnectUI();
    const { toast } = useToast();

    const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
    const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TON');

    useEffect(() => {
        if (!uid) return;
        getSystemConfig().then(setSystemConfig);
        const unsub = onSnapshot(doc(db, 'users', uid as string), (docSnap) => {
            if (docSnap.exists() && docSnap.data().isCreator) {
                setCreatorProfile(docSnap.data() as UserProfile);
            } else {
                toast({ variant: 'destructive', title: 'Creator not found' });
                router.push('/discover');
            }
        });
        return () => unsub();
    }, [uid, router, toast]);

    const handleSubscribe = async () => {
        if (!currentUser || !creatorProfile || !systemConfig) {
            toast({ variant: "destructive", title: "Authentication Required", description: "Please connect your wallet first." });
            return;
        }

        const subscriptionPrice = creatorProfile.creatorData?.subscriptionPriceMonthly ?? 0;
        const treasuryWallet = systemConfig.treasury_wallets[selectedNetwork];

        if (!treasuryWallet || treasuryWallet.includes("REPLACE")) {
            toast({ variant: "destructive", title: "Config Error", description: `Treasury wallet for ${selectedNetwork} is not configured yet.` });
            return;
        }

        setIsProcessing(true);
        try {
            let txHash: string;

            if (selectedNetwork === 'TON') {
                if (!tonConnectUI.connected) {
                    await tonConnectUI.openModal();
                    setIsProcessing(false);
                    return;
                }
                
                // Real TON-based transfer (Native for demo, Jetton payload for prod)
                const result = await tonConnectUI.sendTransaction({
                    validUntil: Math.floor(Date.now() / 1000) + 360,
                    messages: [{ 
                        address: treasuryWallet, 
                        amount: (subscriptionPrice * 1_000_000_000).toString() 
                    }]
                });
                txHash = result.boc;
            } else {
                // Real TRON USDT (TRC20) Transfer
                const provider = (window as any).tronWeb;
                if (!provider) throw new Error("TronLink not found. Please install TronLink extension.");
                
                const usdtContractAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"; 
                const contract = await provider.contract().at(usdtContractAddress);
                const amountInSun = (subscriptionPrice * 1_000_000).toString(); // 6 decimals
                
                const result = await contract.transfer(treasuryWallet, amountInSun).send();
                txHash = result;
            }

            if (!txHash) throw new Error("Transaction cancelled by user.");

            // Success: Record the subscription in Firestore
            await recordUsdtSubscription(currentUser, creatorProfile, systemConfig, selectedNetwork, txHash);
            
            toast({ title: "Subscription Active!", description: `You are now subscribed to ${creatorProfile.username}.` });
            router.push(`/profile/${uid}`);

        } catch (e: any) {
            console.error("Subscription failed:", e);
            toast({ 
                variant: 'destructive', 
                title: "Payment Failed", 
                description: e.message || "An error occurred during the transaction." 
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!creatorProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="animate-spin w-10 h-10 text-primary" />
                <p className="text-muted-foreground font-headline">Fetching Creator Profile...</p>
            </div>
        );
    }
    
    const { username, avatar, bio } = creatorProfile;
    const price = creatorProfile.creatorData?.subscriptionPriceMonthly ?? 0;

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <header className="flex items-center gap-4 mb-8">
                 <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-full bg-white/5">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-headline font-bold">Subscribe to Creator</h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <div className="md:col-span-2 flex flex-col items-center text-center space-y-4">
                    <Avatar className="w-40 h-40 border-4 border-primary/20 shadow-2xl">
                        <AvatarImage src={avatar} className="object-cover" />
                        <AvatarFallback>{username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-2xl font-headline font-bold">{username}</h2>
                        <p className="text-sm text-muted-foreground line-clamp-4 mt-2">{bio}</p>
                    </div>
                </div>

                <Card className="md:col-span-3 glass-card border-white/10 relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 right-0 p-4">
                        <ShieldCheck className="text-primary w-8 h-8 opacity-10" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Monthly Membership</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black font-headline text-primary tracking-tighter">{price}</span>
                            <span className="text-xl font-bold text-muted-foreground">USDT</span>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Choose Payment Network</Label>
                            <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4">
                                <div className="flex-1">
                                    <RadioGroupItem value="TON" id="s-ton" className="sr-only" />
                                    <Label htmlFor="s-ton" className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedNetwork === 'TON' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                                        <span className="font-bold text-lg">TON</span>
                                        <span className="text-[10px] opacity-50 font-bold uppercase">USDT</span>
                                    </Label>
                                </div>
                                <div className="flex-1">
                                    <RadioGroupItem value="TRON" id="s-tron" className="sr-only" />
                                    <Label htmlFor="s-tron" className={`flex flex-col items-center justify-center py-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedNetwork === 'TRON' ? 'border-primary bg-primary/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                                        <span className="font-bold text-lg">TRON</span>
                                        <span className="text-[10px] opacity-50 font-bold uppercase">TRC20</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <Button onClick={handleSubscribe} disabled={isProcessing} className="w-full h-16 text-xl font-black rounded-[1.5rem] shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90">
                            {isProcessing ? <Loader2 className="animate-spin mr-3 w-6 h-6" /> : <Zap className="mr-3 w-5 h-5 fill-current" />}
                            SUBSCRIBE NOW
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest opacity-60">Verified On-Chain Transaction</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ArrowLeft } from 'lucide-react';
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
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON' | null>(null);

    useEffect(() => {
        if (!uid) return;
        getSystemConfig().then(setSystemConfig);
        const unsub = onSnapshot(doc(db, 'users', uid as string), (doc) => {
            if (doc.exists() && doc.data().isCreator) {
                setCreatorProfile(doc.data() as UserProfile);
            } else {
                toast({ variant: 'destructive', title: 'Creator not found', description: 'The creator you are trying to subscribe to does not exist.' });
                router.push('/discover');
            }
        });
        return () => unsub();
    }, [uid, router, toast]);

    const acceptedNetworks = useMemo(() => {
        if (!creatorProfile?.creatorData?.payoutWallets) return [];
        const networks: ('TRON' | 'TON')[] = [];
        if (creatorProfile.creatorData.payoutWallets.TON?.address) networks.push('TON');
        if (creatorProfile.creatorData.payoutWallets.TRON?.address) networks.push('TRON');
        return networks;
    }, [creatorProfile]);

    useEffect(() => {
        if (acceptedNetworks.length > 0 && !selectedNetwork) {
            setSelectedNetwork(acceptedNetworks.includes('TON') ? 'TON' : acceptedNetworks[0]);
        }
    }, [acceptedNetworks, selectedNetwork]);

    const handleSubscribe = async () => {
        if (!currentUser || !creatorProfile || !systemConfig || !selectedNetwork) {
            toast({ variant: "destructive", title: "Error", description: "Could not process subscription. Please log in and try again." });
            return;
        }
        const subscriptionPrice = creatorProfile.creatorData?.subscriptionPriceMonthly ?? 0;
        if (subscriptionPrice <= 0) {
            toast({ variant: "destructive", title: "Not for Sale", description: "This creator has not set a subscription price." });
            return;
        }

        setIsProcessing(true);
        try {
            const treasuryWallet = systemConfig.treasury_wallets[selectedNetwork];
            if (!treasuryWallet) throw new Error(`Treasury wallet for ${selectedNetwork} is not configured.`);

            let txHash: string;
            if (selectedNetwork === 'TON') {
                if (!tonConnectUI.connected) {
                    await tonConnectUI.openModal();
                }
                const result = await tonConnectUI.sendTransaction({
                    validUntil: Math.floor(Date.now() / 1000) + 360,
                    messages: [{ address: treasuryWallet, amount: (subscriptionPrice * 1_000_000).toString() }]
                });
                txHash = result.boc;
            } else { 
                toast({ title: "Notice", description: "TRON integration is for demonstration purposes." });
                txHash = `fake_tron_tx_${Date.now()}`;
            }

            await recordUsdtSubscription(currentUser, creatorProfile, systemConfig, selectedNetwork, txHash);
            toast({ title: "Success!", description: `You are now subscribed to ${creatorProfile.username}. Redirecting...` });
            router.push(`/profile/${uid}`);

        } catch (e: any) {
            console.error("Subscription failed", e);
            toast({ variant: 'destructive', title: "Subscription Failed", description: e.message || "An unknown error occurred during the transaction." });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!creatorProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="mt-4 text-muted-foreground">Loading Creator Profile...</p>
            </div>
        );
    }
    
    const { username, avatarUrl, creatorData, displayName } = creatorProfile;
    const subscriptionPriceMonthly = creatorData?.subscriptionPriceMonthly ?? 0;

    return (
        <div className="flex items-center justify-center min-h-screen bg-grid-pattern p-4">
            <Button variant="ghost" onClick={() => router.back()} className="absolute top-6 left-6 z-20 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm rounded-full p-2 h-auto">
                <ArrowLeft className="w-5 h-5" />
            </Button>
            <Card className="glass-card max-w-md w-full shadow-2xl">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <Avatar className="w-24 h-24 border-4 border-primary/50">
                            <AvatarImage src={avatarUrl} alt={username} />
                            <AvatarFallback>{username?.[0]}</AvatarFallback>
                        </Avatar>
                    </div>
                    <CardTitle className="font-headline text-2xl">Subscribe to {displayName || username}</CardTitle>
                    <CardDescription>
                        Unlock all exclusive content for just <span className="font-bold text-primary">${subscriptionPriceMonthly} USDT</span> per month.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {acceptedNetworks.length > 0 && selectedNetwork ? (
                         <div className="space-y-4">
                             <Label className="font-semibold text-muted-foreground text-sm">PAY WITH USDT ON</Label>
                              <RadioGroup defaultValue={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="grid grid-cols-2 gap-4">
                                {acceptedNetworks.includes('TON') && (
                                    <div>
                                        <RadioGroupItem value="TON" id="ton-sub" className="peer sr-only" />
                                        <Label htmlFor="ton-sub" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                            TON
                                        </Label>
                                    </div>
                                )}
                                {acceptedNetworks.includes('TRON') && (
                                     <div>
                                        <RadioGroupItem value="TRON" id="tron-sub" className="peer sr-only" />
                                        <Label htmlFor="tron-sub" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                                            TRON
                                        </Label>
                                    </div>
                                )}
                             </RadioGroup>
                         </div>
                    ) : (
                        <p className="text-center text-destructive py-4">This creator is not set up to receive payments.</p>
                    )}

                    <Button onClick={handleSubscribe} disabled={isProcessing || acceptedNetworks.length === 0} className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20">
                        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : `Pay $${subscriptionPriceMonthly} with ${selectedNetwork}`}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}


"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { useAccount, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, SystemConfig } from '@/lib/types';
import { getSystemConfig, recordUsdcSubscription } from '@/lib/ledger';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, ShieldCheck, Zap } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function SubscribePage() {
    const t = useTranslations('Subscribe');
    const { uid } = useParams();
    const router = useRouter();
    const { user: currentUser } = useWallet();
    const { chain, connector } = useAccount();
    const isSmartWallet = connector?.id === 'coinbaseWallet';
    const { switchChainAsync } = useSwitchChain();
    const { writeContractAsync } = useWriteContract();
    const { toast } = useToast();

    const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
    const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!uid) return;
        getSystemConfig().then(setSystemConfig);
        const unsub = onSnapshot(doc(db, 'users', uid as string), (docSnap) => {
            if (docSnap.exists() && docSnap.data().isCreator) {
                setCreatorProfile(docSnap.data() as UserProfile);
            } else {
                toast({ variant: 'destructive', title: t('creatorNotFound') });
                router.push('/');
            }
        });
        return () => unsub();
    }, [uid, router, toast, t]);

    const handleSubscribe = async () => {
        if (!currentUser || !creatorProfile || !systemConfig) {
            toast({ variant: "destructive", title: t('authRequired'), description: t('connectWalletDesc') });
            return;
        }

        const subscriptionPrice = creatorProfile.creatorData?.subscriptionPriceMonthly ?? 0;
        const treasuryAddress = systemConfig.treasury_address;

        if (!treasuryAddress) {
            toast({ variant: "destructive", title: t('configError'), description: t('treasuryNotConfigured') });
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Ensure we are on Base
            if (chain?.id !== base.id) {
                try {
                    await switchChainAsync({ chainId: base.id });
                } catch (switchError) {
                    throw new Error("Please switch to Base network to complete the subscription.");
                }
            }

            // 2. Execute USDC Transfer
            const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
            const usdcDecimals = 6;
            const amountInUnits = parseUnits(subscriptionPrice.toString(), usdcDecimals);

            const txHash = await writeContractAsync({
                address: usdcAddress as `0x${string}`,
                abi: [
                    {
                        constant: false,
                        inputs: [
                            { name: "_to", type: "address" },
                            { name: "_value", type: "uint256" }
                        ],
                        name: "transfer",
                        outputs: [{ name: "", type: "bool" }],
                        type: "function"
                    }
                ],
                functionName: 'transfer',
                args: [treasuryAddress as `0x${string}`, amountInUnits],
                // @ts-ignore - capabilities is an experimental feature in wagmi
                capabilities: {
                    paymasterService: {
                        url: process.env.NEXT_PUBLIC_PAYMASTER_URL
                    }
                }
            });

            if (!txHash) throw new Error("Transaction cancelled by user.");

            // Success: Record the subscription in Firestore
            await recordUsdcSubscription(currentUser, creatorProfile, systemConfig, 'Base', txHash);
            
            toast({ title: t('activeSuccess'), description: t('subscribedTo', { username: creatorProfile.username }) });
            router.push(`/profile/${uid}`);

        } catch (e: any) {
            console.error("Subscription failed:", e);
            toast({ 
                variant: 'destructive', 
                title: t('paymentFailed'), 
                description: e.message || t('defaultTransactionError')
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!creatorProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="animate-spin w-10 h-10 text-primary" />
                <p className="text-muted-foreground font-headline">{t('fetchingProfile')}</p>
            </div>
        );
    }
    
    const { username, avatar, bio } = creatorProfile;
    const price = creatorProfile.creatorData?.subscriptionPriceMonthly ?? 0;

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <header className="flex items-center gap-4 mb-8">
                 <Link href={`/profile/${uid}`}>
                    <Button variant="outline">{t('backToProfile')}</Button>
                </Link>
                <h1 className="text-2xl font-headline font-bold">{t('title')}</h1>
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
                        <CardTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{t('monthlyMembership')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-black font-headline text-primary tracking-tighter">{price}</span>
                            <span className="text-xl font-bold text-muted-foreground">USDC</span>
                        </div>

                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg bg-primary/10">
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Base Network</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Native USDC Payment</p>
                                </div>
                            </div>
                            {isSmartWallet && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] font-bold">Gas-less Ready</Badge>
                            )}
                        </div>

                        <Button onClick={handleSubscribe} disabled={isProcessing} className="w-full h-16 text-xl font-black rounded-[1.5rem] shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90">
                            {isProcessing ? <Loader2 className="animate-spin mr-3 w-6 h-6" /> : <Zap className="mr-3 w-5 h-5 fill-current" />}
                            {t('subscribeNow')}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest opacity-60">{t('onChainVerified')}</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

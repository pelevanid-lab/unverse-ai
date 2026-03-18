
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile, NetworkWallet } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Star, ChevronLeft, ShieldAlert } from 'lucide-react';

function isValidTronAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function isValidTonAddress(address: string): boolean {
    // TON addresses can start with EQ, UQ, or other prefixes and are usually 48 chars
    // This regex covers standard Base64 user-friendly addresses
    return /^[a-zA-Z0-9_-]{48}$/.test(address) || (address.length > 40 && (address.startsWith('EQ') || address.startsWith('UQ')));
}

export default function CollectionWalletsPage() {
    const router = useRouter();
    const { user, isConnected } = useWallet();
    const { toast } = useToast();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TRON');
    const [walletAddress, setWalletAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.uid) {
            const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                if (docSnap.exists() && docSnap.data().isCreator) {
                    setUserProfile(docSnap.data() as UserProfile);
                } else if (docSnap.exists() && !docSnap.data().isCreator) {
                     router.push('/creator');
                }
            });
            return () => unsub();
        }
    }, [user, router]);

    const handleSaveWallet = async () => {
        if (!user?.uid) return;

        const validationPasses = selectedNetwork === 'TRON' ? isValidTronAddress(walletAddress) : isValidTonAddress(walletAddress);
        if (!validationPasses) {
            toast({ 
                variant: "destructive", 
                title: "Invalid Address", 
                description: `The ${selectedNetwork} address format is incorrect. Please check again.` 
            });
            return;
        }

        setIsSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const newWallet: NetworkWallet = { address: walletAddress, verified: true };

            await updateDoc(userRef, {
                [`creatorData.payoutWallets.${selectedNetwork}`]: newWallet,
                ...(!userProfile?.creatorData?.preferredPayoutNetwork && { 'creatorData.preferredPayoutNetwork': selectedNetwork }),
            });

            toast({ title: "Address Saved", description: `Your ${selectedNetwork} USDT address has been updated.` });
            setWalletAddress('');
        } catch (error) {
            console.error("Failed to save address:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save your address." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefault = async (network: 'TRON' | 'TON') => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { 'creatorData.preferredPayoutNetwork': network });
            toast({ title: "Default Updated", description: `${network} is now your default payout network.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Update Failed", description: "Could not set the default network." });
        }
    };

    if (!isConnected || !user || !userProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <h1 className="text-3xl font-headline font-bold">Loading...</h1>
            </div>
        );
    }
    
    const payoutWallets = userProfile.creatorData?.payoutWallets;
    const preferredNetwork = userProfile.creatorData?.preferredPayoutNetwork;

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
            <header className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.push('/wallet')} className="h-10 w-10 rounded-full bg-white/5">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text">Collection Addresses</h1>
                    <p className="text-muted-foreground">Manage where you receive your USDT earnings.</p>
                </div>
            </header>

            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-4">
                <ShieldAlert className="w-6 h-6 text-orange-400 shrink-0" />
                <div className="text-sm">
                    <p className="font-bold text-orange-400">Important</p>
                    <p className="text-muted-foreground leading-relaxed">
                        These are not connected wallets; they are <b>static USDT withdrawal addresses</b>. 
                        Please ensure you provide addresses you own on the respective networks. 
                        Earnings will be sent to these addresses upon claim approval.
                    </p>
                </div>
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle>Your Saved USDT Addresses</CardTitle>
                    <CardDescription>Earnings will be transferred to these destinations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(!payoutWallets || Object.keys(payoutWallets).length === 0) && (
                        <p className="text-sm text-center text-muted-foreground py-4 italic">No payout addresses added yet.</p>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                        {payoutWallets?.TRON && (
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">TRON (USDT - TRC20)</p>
                                    <p className="font-mono text-sm truncate max-w-[200px] sm:max-w-none">{payoutWallets.TRON.address}</p>
                                </div>
                                {preferredNetwork === 'TRON' ?
                                    <span className='flex items-center text-xs text-yellow-400 font-bold gap-1 bg-yellow-400/10 px-3 py-1.5 rounded-full border border-yellow-400/20'><Star size={14} className="fill-yellow-400" /> Default</span> :
                                    <Button size='sm' variant='outline' className="rounded-full border-white/10" onClick={() => handleSetDefault('TRON')}>Set Default</Button>}
                            </div>
                        )}
                        {payoutWallets?.TON && (
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">TON (USDT)</p>
                                    <p className='font-mono text-sm truncate max-w-[200px] sm:max-w-none'>{payoutWallets.TON.address}</p>
                                </div>
                                {preferredNetwork === 'TON' ?
                                    <span className='flex items-center text-xs text-yellow-400 font-bold gap-1 bg-yellow-400/10 px-3 py-1.5 rounded-full border border-yellow-400/20'><Star size={14} className="fill-yellow-400" /> Default</span> :
                                    <Button size='sm' variant='outline' className="rounded-full border-white/10" onClick={() => handleSetDefault('TON')}>Set Default</Button>}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle>Add or Update Address</CardTitle>
                    <CardDescription>Provide a valid USDT address to receive payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">1. Select Network</Label>
                        <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4">
                            <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer">
                                <RadioGroupItem value="TRON" id="p-tron" />
                                <Label htmlFor="p-tron" className="cursor-pointer font-bold">TRON</Label>
                            </div>
                            <div className="flex items-center space-x-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5 cursor-pointer">
                                <RadioGroupItem value="TON" id="p-ton" />
                                <Label htmlFor="p-ton" className="cursor-pointer font-bold">TON</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-3">
                         <Label className="text-sm font-medium">
                            2. {selectedNetwork} (USDT) Destination Address
                         </Label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                placeholder={
                                    selectedNetwork === 'TRON'
                                        ? "Enter your TRON USDT (TRC20) address (T...)"
                                        : "Enter your TON USDT address (EQ... / UQ...)"
                                }
                                className="font-mono h-11"
                            />
                            <Button onClick={handleSaveWallet} disabled={isSaving || !walletAddress} className="h-11 sm:w-32 font-bold shadow-lg shadow-primary/20">
                                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                Save
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Double check your address. Transfers are irreversible.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

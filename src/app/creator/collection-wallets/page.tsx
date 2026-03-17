
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Creator, UserProfile, NetworkWallet } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Wallet, Star, ChevronLeft } from 'lucide-react';

function isValidTronAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

function isValidTonAddress(address: string): boolean {
    return address.startsWith('EQ') && address.length > 40;
}

export default function CollectionWalletsPage() {
    const router = useRouter();
    const { user, isConnected } = useWallet();
    const { toast } = useToast();
    const [creator, setCreator] = useState<Creator | null>(null);
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON'>('TRON');
    const [walletAddress, setWalletAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.uid) {
            const unsub = onSnapshot(doc(db, 'creators', user.uid), (doc) => {
                if (doc.exists()) {
                    setCreator(doc.data() as Creator);
                } else {
                    // If for some reason a user lands here without a creator profile
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
            toast({ variant: "destructive", title: "Invalid Address", description: `Please enter a valid ${selectedNetwork} wallet address.` });
            return;
        }

        setIsSaving(true);
        try {
            const creatorRef = doc(db, 'creators', user.uid);
            const newWallet: NetworkWallet = { address: walletAddress, verified: true }; // Assuming verification

            await updateDoc(creatorRef, {
                [`payoutWallets.${selectedNetwork}`]: newWallet,
                // Set as default if it's the first wallet being added
                ...(!creator?.payoutWallets || Object.keys(creator.payoutWallets).length === 0 ? { preferredPayoutNetwork: selectedNetwork } : {}),
            });

            toast({ title: "Collection Wallet Saved", description: `Your ${selectedNetwork} wallet has been added.` });
            setWalletAddress('');
        } catch (error) {
            console.error("Failed to save collection wallet:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save your wallet." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefault = async (network: 'TRON' | 'TON') => {
        if (!user?.uid) return;
        try {
            const creatorRef = doc(db, 'creators', user.uid);
            await updateDoc(creatorRef, { preferredPayoutNetwork: network });
            toast({ title: "Default Updated", description: `${network} is now your default collection network.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Update Failed", description: "Could not set the default network." });
        }
    };

    if (!isConnected || !user || !creator) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <h1 className="text-3xl font-headline font-bold">Loading...</h1>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
            <header className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ChevronLeft /></Button>
                <h1 className="text-4xl font-headline font-bold gradient-text">Collection Wallets</h1>
            </header>

            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Your Saved Wallets</CardTitle>
                    <CardDescription>These are the wallets where you will receive your earnings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(!creator.payoutWallets || Object.keys(creator.pyoutWallets).length === 0) && (
                        <p className="text-sm text-center text-muted-foreground py-4">No collection wallets added yet.</p>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                        {creator.payoutWallets?.TRON && (
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="font-mono text-sm truncate"><b>TRON:</b> {creator.payoutWallets.TRON.address}</div>
                                {creator.preferredPayoutNetwork === 'TRON' ?
                                    <span className='flex items-center text-xs text-primary gap-1'><Star size={12} /> Default</span> :
                                    <Button size='sm' variant='ghost' onClick={() => handleSetDefault('TRON')}>Set Default</Button>}
                            </div>
                        )}
                        {creator.payoutWallets?.TON && (
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className='font-mono text-sm truncate'><b>TON:</b> {creator.payoutWallets.TON.address}</div>
                                {creator.preferredPayoutNetwork === 'TON' ?
                                    <span className='flex items-center text-xs text-primary gap-1'><Star size={12} /> Default</span> :
                                    <Button size='sm' variant='ghost' onClick={() => handleSetDefault('TON')}>Set Default</Button>}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Add a New Wallet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>1. Select Network</Label>
                        <RadioGroup value={selectedNetwork} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="TRON" id="p-tron" />
                                <Label htmlFor="p-tron">TRON</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="TON" id="p-ton" />
                                <Label htmlFor="p-ton">TON</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                         <Label>
                            {selectedNetwork === 'TRON' 
                                ? "TRON (USDT - TRC20) Wallet Address"
                                : "TON (USDT) Wallet Address"}
                         </Label>
                        <div className="flex gap-2">
                            <Input
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                placeholder={
                                    selectedNetwork === 'TRON'
                                        ? "Enter your TRON USDT (TRC20) address (e.g., T...)"
                                        : "Enter your TON USDT address (e.g., EQ...)"
                                }
                                className="font-mono"
                            />
                            <Button onClick={handleSaveWallet} disabled={isSaving || !walletAddress} className="w-24">
                                {isSaving ? <Loader2 className="animate-spin" /> : 'Save'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

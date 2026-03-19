
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Loader2, CheckCircle, ChevronLeft, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, NetworkWallet } from '@/lib/types';
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTonConnectUI } from '@tonconnect/ui-react';


// Specific component for a single network wallet (TRON, TON, etc.)
function NetworkWalletManager({ 
    user,
    network,
    onConnect,
    setSelectedNetwork 
}: { 
    user: UserProfile, 
    network: 'TRON' | 'TON',
    onConnect: (network: 'TRON' | 'TON', address: string) => Promise<void>,
    setSelectedNetwork: (network: 'TRON' | 'TON') => void
}) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [tonConnectUI] = useTonConnectUI();
    const walletInfo = user.paymentWallets?.[network];

    const handleConnectClick = async () => {
        if (network === 'TRON') {
            const provider = (window as any).tronWeb;
            if (!provider || !provider.ready) {
                toast({ variant: "destructive", title: "TronLink Not Found", description: "Please install the TronLink extension, unlock it, and refresh." });
                return;
            }
            setIsLoading(true);
            try {
                const res = await provider.request({ method: 'tron_requestAccounts' });
                // Check if the user rejected the request
                if (res.code === 4001) {
                    throw new Error("Connection request was rejected by the user.");
                }
                const address = provider.defaultAddress.base58;
                if (!address) throw new Error("Wallet address could not be retrieved.");
                await onConnect(network, address);
                setSelectedNetwork('TRON'); // Update UI immediately
            } catch (error: any) {
                toast({ variant: "destructive", title: `${network} Connection Failed`, description: error.message });
            } finally {
                setIsLoading(false);
            }
        } else if (network === 'TON') {
             setIsLoading(true);
 
             const unsubscribe = tonConnectUI.onStatusChange(wallet => {
                 unsubscribe(); 
                 if (wallet) {
                     const address = wallet.account.address;
                     onConnect('TON', address).then(() => {
                        setSelectedNetwork('TON'); // Update UI immediately
                     }).catch((error: any) => {
                         toast({ variant: "destructive", title: "TON Wallet Assignment Failed", description: error.message });
                     }).finally(() => {
                         setIsLoading(false);
                     });
                 } else {
                     toast({ variant: "default", title: "TON Connection Canceled" });
                     setIsLoading(false);
                 }
             });
 
             tonConnectUI.openModal();
        }
    };

    const handleDisconnect = async () => {
        if (!user.uid) return;
        setIsLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                [`paymentWallets.${network}`]: null,
            });
            toast({ title: `${network} Wallet Disconnected` });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Disconnection Failed", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="glass-card border-white/10">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{network} Payment Wallet</span>
                    {user.preferredPaymentNetwork === network && <div className="flex items-center gap-1 text-xs text-yellow-400"><Star size={14}/> Preferred</div>}
                </CardTitle>
                <CardDescription>Connect your {network} wallet for on-chain payments.</CardDescription>
            </CardHeader>
            <CardContent>
                {walletInfo && walletInfo.verified ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg font-mono text-sm">
                           {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                           <span className='flex items-center gap-1 text-green-400 text-xs'><CheckCircle size={14}/> Connected</span>
                        </div>
                        <Button variant="outline" className='border-destructive/50 text-destructive' onClick={handleDisconnect} disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin h-4 w-4"/> : 'Disconnect'}
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleConnectClick} disabled={isLoading} className="bg-primary hover:bg-primary/90">
                        {isLoading ? <Loader2 className="animate-spin"/> : `Connect ${network} Wallet`}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export default function PaymentWalletsPage() {
    const router = useRouter();
    const { user, isConnected } = useWallet();
    const [selectedNetwork, setSelectedNetwork] = useState<'TRON' | 'TON' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Sync state with user data when it loads
    useEffect(() => {
        if (user?.preferredPaymentNetwork) {
            setSelectedNetwork(user.preferredPaymentNetwork);
        } else if (user?.paymentWallets?.TON?.verified) {
            setSelectedNetwork('TON');
        } else if (user?.paymentWallets?.TRON?.verified) {
            setSelectedNetwork('TRON');
        } else {
            setSelectedNetwork(null);
        }
    }, [user]);

    if (!isConnected || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                 <Wallet className="w-12 h-12 text-primary" />
                 <h1 className="text-3xl font-headline font-bold">Payment Wallets</h1>
                 <p className="text-muted-foreground">Please connect your main identity wallet first.</p>
            </div>
        )
    }

    const handleWalletConnect = async (network: 'TRON' | 'TON', address: string) => {
        const userRef = doc(db, 'users', user.uid);
        const updates: any = { [`paymentWallets.${network}`]: { address, verified: true } };

        // Set as preferred only if no preference is set at all.
        if (!user.preferredPaymentNetwork) {
            updates.preferredPaymentNetwork = network;
        }

        await updateDoc(userRef, updates);
        toast({ title: `${network} Wallet Connected`, description: `Address: ${address.slice(0,6)}...` });
    };

    const handleSavePreferences = async () => {
        if (!selectedNetwork) {
            toast({variant: "destructive", title: "No network selected"});
            return;
        }
        setIsSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { preferredPaymentNetwork: selectedNetwork });
            toast({ title: "Preferences Saved", description: `${selectedNetwork} is now your default payment network.` });
        } catch (error: any) {
             toast({ variant: "destructive", title: "Save Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => router.push('/mypage')} className="h-10 w-10 rounded-full bg-white/5">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text">Payment Wallets</h1>
                    <p className="text-muted-foreground">Manage your wallets for purchases and subscriptions.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NetworkWalletManager user={user} network="TRON" onConnect={handleWalletConnect} setSelectedNetwork={setSelectedNetwork} />
                <NetworkWalletManager user={user} network="TON" onConnect={handleWalletConnect} setSelectedNetwork={setSelectedNetwork} />
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                    <CardDescription>Select your default network for making payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <RadioGroup value={selectedNetwork || ""} onValueChange={(v) => setSelectedNetwork(v as 'TRON' | 'TON')}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TRON" id="r-tron" disabled={!user.paymentWallets?.TRON?.verified} />
                            <Label htmlFor="r-tron" className={`cursor-pointer ${!user.paymentWallets?.TRON?.verified ? 'text-muted-foreground/50' : ''}`}>TRON</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TON" id="r-ton" disabled={!user.paymentWallets?.TON?.verified} />
                            <Label htmlFor="r-ton" className={`cursor-pointer ${!user.paymentWallets?.TON?.verified ? 'text-muted-foreground/50' : ''}`}>TON</Label>
                        </div>
                    </RadioGroup>
                    <Button 
                        onClick={handleSavePreferences} 
                        disabled={isSaving || selectedNetwork === user.preferredPaymentNetwork || !selectedNetwork}
                        className="w-full sm:w-auto mt-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : null}
                        Save Preference
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

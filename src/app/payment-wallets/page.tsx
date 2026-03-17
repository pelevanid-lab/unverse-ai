
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Loader2, CheckCircle, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import Link from 'next/link';

function TronPaymentWallet({ user }: { user: UserProfile }) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleConnect = async () => {
        const tronWeb = (window as any).tronWeb;
        if (!tronWeb) {
            toast({
                variant: "destructive",
                title: "TronLink Not Found",
                description: "Please install the TronLink browser extension to connect a TRON wallet.",
            });
            return;
        }

        setIsLoading(true);
        try {
            await tronWeb.request({ method: 'tron_requestAccounts' });
            const connectedAddress = tronWeb.defaultAddress.base58;
            if (!connectedAddress) {
                throw new Error("Wallet connection was cancelled or failed.");
            }

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                paymentWalletAddress: connectedAddress,
                paymentNetwork: 'TRON',
                paymentWalletVerified: true
            });

            toast({
                title: "Payment Wallet Connected",
                description: `Your wallet ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)} has been set for payments.`,
            });

        } catch (error: any) {
            console.error("Failed to connect payment wallet:", error);
            toast({
                variant: "destructive",
                title: "Connection Failed",
                description: error.message || "Could not connect your payment wallet. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!user.uid) return;

        setIsLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                paymentWalletAddress: "",
                paymentNetwork: "",
                paymentWalletVerified: false
            });
            toast({
                title: "Payment Wallet Disconnected",
                description: "Your payment wallet has been removed.",
            });
        } catch (error) {
            console.error("Failed to disconnect payment wallet:", error);
            toast({
                variant: "destructive",
                title: "Disconnection Failed",
                description: "Could not disconnect your payment wallet. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const hasPaymentWallet = user.paymentWalletAddress && user.paymentWalletVerified;

    return (
         <Card className="glass-card border-white/10">
            <CardHeader>
                <CardTitle>TRON Payment Wallet</CardTitle>
                <CardDescription>
                    {hasPaymentWallet 
                        ? "This wallet is currently used for all on-chain payments."
                        : "Connect a TRON wallet for all on-chain payments, like buying ULC or subscriptions."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasPaymentWallet ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-white/10">
                            <div className='font-mono text-sm'>
                                {user.paymentWalletAddress}
                            </div>
                            <div className='flex items-center gap-2 text-xs'>
                                    <span className='bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full'>TRON</span>
                                    <span className='flex items-center gap-1 text-green-400'><CheckCircle size={14}/> Connected</span>
                            </div>
                        </div>
                        <Button variant="outline" className='border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive' onClick={handleDisconnect} disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin h-4 w-4"/> : 'Disconnect'}
                        </Button>
                    </div>
                ) : (
                    <Button onClick={handleConnect} disabled={isLoading} className="bg-primary hover:bg-primary/90">
                        {isLoading ? <Loader2 className="animate-spin"/> : 'Connect TRON Wallet'}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export default function PaymentWalletsPage() {
    const router = useRouter();
    const { user, isConnected } = useWallet();

    if (!isConnected || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
                 <Wallet className="w-12 h-12 text-primary" />
                 <h1 className="text-3xl font-headline font-bold">Payment Wallets</h1>
                 <p className="text-muted-foreground max-w-sm">Please connect your main wallet to continue.</p>
                 <Link href="/"><Button>Connect Now</Button></Link>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <header className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                  onClick={() => router.back()}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text">Payment Wallets</h1>
                    <p className="text-muted-foreground">Manage your wallets for purchases and subscriptions.</p>
                </div>
            </header>

            <TronPaymentWallet user={user} />

        </div>
    );
}


"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { calculateCreatorUsdtEarnings, createClaimRequest } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function UsdtEarningsCard() {
    const { user, isCreator, creator } = useWallet();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [availableUsdt, setAvailableUsdt] = useState(0);
    const [pendingClaims, setPendingClaims] = useState(0);

    useEffect(() => {
        if (user?.uid && isCreator) {
            setIsLoading(true);
            calculateCreatorUsdtEarnings(user.uid)
                .then(({ available, pending }) => {
                    setAvailableUsdt(available);
                    setPendingClaims(pending);
                })
                .catch(err => {
                    console.error("Error fetching USDT earnings:", err);
                    toast({ variant: "destructive", title: "Error", description: "Could not fetch your earnings data." });
                })
                .finally(() => setIsLoading(false));
        }
    }, [user, isCreator, toast]);

    const handleClaimRequest = async () => {
        if (!creator) {
             toast({ variant: "destructive", title: "Error", description: "Creator data not found." });
             return;
        }
        
        const preferredNetwork = creator.preferredPayoutNetwork;
        if (!preferredNetwork) {
             toast({ variant: "destructive", title: "Action Required", description: "Please set a default collection network in your settings." });
             router.push('/creator/collection-wallets');
             return;
        }

        const walletAddress = creator.payoutWallets?.[preferredNetwork]?.address;
         if (!walletAddress) {
             toast({ variant: "destructive", title: "Action Required", description: `Your ${preferredNetwork} collection wallet is not configured.` });
             router.push('/creator/collection-wallets');
             return;
        }

        setIsClaiming(true);
        try {
            const claimId = await createClaimRequest(creator);
            toast({ title: "Claim Request Submitted", description: `Your request for ${availableUsdt.toFixed(2)} USDT has been submitted.` });
            // Refresh data
            const { available, pending } = await calculateCreatorUsdtEarnings(creator.uid);
            setAvailableUsdt(available);
            setPendingClaims(pending);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Claim Failed", description: error.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const canClaim = availableUsdt > 0 && pendingClaims === 0;

    return (
        <Card className="glass-card border-white/10">
            <CardHeader>
                <CardTitle>USDT Earnings</CardTitle>
                <CardDescription>Claim your earnings from subscriptions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Available for Claim</p>
                            <p className="text-4xl font-bold">${availableUsdt.toFixed(2)}</p>
                        </div>
                        {pendingClaims > 0 && (
                            <div className="p-3 rounded-lg bg-yellow-900/50 text-yellow-300 flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5"/>
                                <div>
                                    <h4 className="font-bold">Pending Request</h4>
                                    <p className="text-sm">You have a claim for ${pendingClaims.toFixed(2)} being processed.</p>
                                </div>
                            </div>
                        )}
                        <Button onClick={handleClaimRequest} disabled={!canClaim || isClaiming} className="w-full">
                            {isClaiming ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <ShieldCheck className="w-4 h-4 mr-2"/>}
                            {pendingClaims > 0 ? 'Claim In Progress' : 'Request Claim'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

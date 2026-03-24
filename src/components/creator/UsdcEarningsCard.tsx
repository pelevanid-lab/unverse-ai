
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { calculateCreatorUsdcEarnings, createClaimRequest } from '@/lib/ledger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

export function UsdcEarningsCard() {
    const { user } = useWallet();
    const { toast } = useToast();
    const isCreator = user?.isCreator;
    const creator = user?.creatorData;

    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [availableUsdc, setAvailableUsdc] = useState(0);
    const [pendingClaims, setPendingClaims] = useState(0);

    useEffect(() => {
        if (user?.uid && isCreator) {
            setIsLoading(true);
            calculateCreatorUsdcEarnings(user.uid)
                .then(({ available, pending }) => {
                    setAvailableUsdc(available);
                    setPendingClaims(pending);
                })
                .catch(err => {
                    console.error("Error fetching USDC earnings:", err);
                    toast({ variant: "destructive", title: "Error", description: "Could not fetch your earnings data." });
                })
                .finally(() => setIsLoading(false));
        }
    }, [user, isCreator, toast]);

    const handleClaimRequest = async () => {
        if (!user || !creator) {
             toast({ variant: "destructive", title: "Error", description: "Creator data not found." });
             return;
        }
        
        // In the new system, we always use the Identity Wallet on Base for payouts.
        // There is no need for preferredPayoutNetwork or collection-wallets settings.

        setIsClaiming(true);
        try {
            // Updated to pass both creator object and the walletAddress from the identity wallet
            const claimId = await createClaimRequest(creator, user.walletAddress);
            toast({ title: "Claim Request Submitted", description: `Your request for ${availableUsdc.toFixed(2)} USDC has been submitted.` });
            // Refresh data
            const { available, pending } = await calculateCreatorUsdcEarnings(user.uid);
            setAvailableUsdc(available);
            setPendingClaims(pending);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Claim Failed", description: error.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const canClaim = availableUsdc > 0 && pendingClaims === 0;

    return (
        <Card className="glass-card border-white/10">
            <CardHeader>
                <CardTitle>USDC Earnings</CardTitle>
                <CardDescription>Claim your earnings from subscriptions on Base.</CardDescription>
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
                            <p className="text-4xl font-bold">${availableUsdc.toFixed(2)}</p>
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
                            {pendingClaims > 0 ? 'Claim In Progress' : 'Request Claim (Base USDC)'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

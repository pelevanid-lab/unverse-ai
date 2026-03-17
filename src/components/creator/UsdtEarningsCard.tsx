
"use client"

import { useState, useEffect } from 'react';
import { Creator } from '@/lib/types';
import { calculateCreatorUsdtEarnings, createClaimRequest } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

interface UsdtEarningsCardProps {
    creator: Creator;
}

export function UsdtEarningsCard({ creator }: UsdtEarningsCardProps) {
    const [availableUsdt, setAvailableUsdt] = useState(0);
    const [pendingClaims, setPendingClaims] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!creator.uid) return;

        const fetchEarnings = async () => {
            setIsLoading(true);
            try {
                const { available, pending } = await calculateCreatorUsdtEarnings(creator.uid);
                setAvailableUsdt(available);
                setPendingClaims(pending);
            } catch (error) {
                console.error("Failed to calculate USDT earnings:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load your earnings data.' });
            }
            setIsLoading(false);
        };

        fetchEarnings();
        
        // We can also set up a listener here if we want real-time updates
        // For now, a fetch on component load is sufficient.

    }, [creator.uid, toast]);

    const handleClaimRequest = async () => {
        setIsClaiming(true);
        try {
            const requestId = await createClaimRequest(creator);
            toast({
                title: 'Claim Request Submitted',
                description: `Your request to claim ${availableUsdt.toFixed(2)} USDT has been sent for review.`,
            });
            // Refresh earnings data after claim
            const { available, pending } = await calculateCreatorUsdtEarnings(creator.uid);
            setAvailableUsdt(available);
            setPendingClaims(pending);
        } catch (error: any) {
            console.error("Claim request failed:", error);
            toast({ variant: 'destructive', title: 'Claim Failed', description: error.message });
        } finally {
            setIsClaiming(false);
        }
    };

    const canClaim = availableUsdt > 0 && pendingClaims === 0;

    return (
        <Card className="glass-card max-w-2xl mx-auto border-white/10 mt-6">
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><Sparkles className="w-5 h-5 text-primary"/> USDT Earnings</CardTitle>
                <CardDescription>Request to claim your available USDT earnings. Claims are reviewed by an admin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className='p-4 bg-muted/50 rounded-lg'>
                        <p className="text-sm text-muted-foreground">Available USDT</p>
                        <p className="text-2xl font-bold">{isLoading ? <Loader2 className='animate-spin mx-auto'/> : `$${availableUsdt.toFixed(2)}`}</p>
                    </div>
                     <div className='p-4 bg-muted/50 rounded-lg'>
                        <p className="text-sm text-muted-foreground">Pending Claims</p>
                        <p className="text-2xl font-bold">{isLoading ? <Loader2 className='animate-spin mx-auto'/> : `$${pendingClaims.toFixed(2)}`}</p>
                    </div>
                </div>
                <Button 
                    onClick={handleClaimRequest} 
                    disabled={isLoading || isClaiming || !canClaim} 
                    className='w-full'
                >
                    {isClaiming && <Loader2 className="animate-spin mr-2"/>}
                    {pendingClaims > 0 ? 'Claim Request is Pending' : 'Request Claim'}
                </Button>
                <p className='text-xs text-muted-foreground text-center'>
                    Claims are processed manually within 1-3 business days. A default collection wallet must be set.
                </p>
            </CardContent>
        </Card>
    );
}

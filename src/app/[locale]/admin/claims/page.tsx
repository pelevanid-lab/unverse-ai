
"use client";

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { updateClaimRequestStatus } from '@/lib/ledger';
import { ClaimRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/routing';

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString();

const getExplorerLink = (network: 'TRON' | 'TON', address: string) => {
    if (network === 'TRON') return `https://tronscan.org/#/address/${address}`;
    if (network === 'TON') return `https://tonscan.org/address/${address}`;
    return '#';
};

export default function AdminClaimsPage() {
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [txHashes, setTxHashes] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const fetchClaims = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'claim_requests'), orderBy('requestedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            setClaims(querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClaimRequest)));
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to load claim requests." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchClaims();
    }, [fetchClaims]);

    const handleAction = async (id: string, status: ClaimRequest['status'], txHash?: string) => {
        if (status === 'completed' && !txHash?.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Transaction Hash is required." });
            return;
        }
        setProcessing(prev => ({ ...prev, [id]: true }));
        try {
            await updateClaimRequestStatus(id, status, undefined, txHash);
            toast({ title: "Success", description: `Claim has been ${status}.` });
            fetchClaims();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Action Failed", description: err.message });
        } finally {
            setProcessing(prev => ({ ...prev, [id]: false }));
        }
    };

    const StatusBadge = ({ status }: { status: ClaimRequest['status'] }) => {
         const variant: "default" | "secondary" | "destructive" | "outline" = {
            pending: "secondary", approved: "default", completed: "outline", rejected: "destructive",
        }[status];
        return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            <Toaster />
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Admin Claims Management</CardTitle>
                    <CardDescription>Review, approve, and process creator claim requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {claims.map((claim) => (
                            <Card key={claim.id} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                    <div className="md:col-span-3 space-y-2">
                                        <p className="text-sm font-mono text-muted-foreground">Creator: {claim.creatorId}</p>
                                        <p className="text-lg font-bold">{claim.amount} {claim.currency}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{claim.network}</Badge>
                                            <Link href={getExplorerLink(claim.network, claim.walletAddress)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:underline">
                                                <span className="font-mono break-all">{claim.walletAddress}</span>
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Requested: {formatDate(claim.requestedAt)}</p>
                                    </div>
                                    <div className="md:col-span-2 flex flex-col items-end space-y-2">
                                        <StatusBadge status={claim.status} />
                                        {processing[claim.id] ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                            <>
                                                {claim.status === 'pending' && (
                                                    <div className="flex gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleAction(claim.id, 'approved')}>Approve</Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleAction(claim.id, 'rejected')}>Reject</Button>
                                                    </div>
                                                )}
                                                {claim.status === 'approved' && (
                                                    <div className="flex flex-col space-y-2 w-full">
                                                        <Input placeholder="Enter Transaction Hash (txHash)" value={txHashes[claim.id] || ''} onChange={(e) => setTxHashes(prev => ({ ...prev, [claim.id]: e.target.value }))} />
                                                        <Button size="sm" onClick={() => handleAction(claim.id, 'completed', txHashes[claim.id])}>Complete Claim</Button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                         {claims.length === 0 && <p>No pending claim requests found.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

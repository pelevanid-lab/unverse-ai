
"use client";

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateClaimRequestStatus } from '@/lib/ledger';
import { ClaimRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, Hourglass, XCircle, CheckCircle } from 'lucide-react';

function ClaimRow({ claim }: { claim: ClaimRequest }) {
    const { toast } = useToast();
    const [isBusy, setIsBusy] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [adminNote, setAdminNote] = useState('');

    const handleUpdate = async (status: ClaimRequest['status']) => {
        if (status === 'completed' && !txHash) {
            toast({ variant: 'destructive', title: 'Error', description: 'Transaction Hash is required to complete a claim.' });
            return;
        }
        if (status === 'rejected' && !adminNote) {
            toast({ variant: 'destructive', title: 'Error', description: 'An admin note is required for rejection.' });
            return;
        }
        
        setIsBusy(true);
        try {
            await updateClaimRequestStatus(claim.id, status, adminNote, txHash);
            toast({ title: 'Success', description: `Claim ${claim.id} has been ${status}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        }
        setIsBusy(false);
    };

    const getStatusBadge = (status: ClaimRequest['status']) => {
        switch (status) {
            case 'pending': return <Badge variant="secondary"><Hourglass className="w-3 h-3 mr-1" />Pending</Badge>;
            case 'approved': return <Badge variant="default" className="bg-blue-500"><ShieldCheck className="w-3 h-3 mr-1" />Approved</Badge>;
            case 'completed': return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
            case 'rejected': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{claim.creatorId}</TableCell>
            <TableCell className="font-medium">{(claim.amount || 0).toFixed(2)} {claim.currency}</TableCell>
            <TableCell>{claim.network}</TableCell>
            <TableCell className="font-mono text-xs">{claim.walletAddress}</TableCell>
            <TableCell>{new Date(claim.requestedAt).toLocaleString()}</TableCell>
            <TableCell>{getStatusBadge(claim.status)}</TableCell>
            <TableCell className="space-y-2 w-[350px]">
                {claim.status === 'pending' && (
                    <div className="flex items-center gap-2">
                         <Input 
                            placeholder="Rejection reason..." 
                            value={adminNote} 
                            onChange={(e) => setAdminNote(e.target.value)}
                            className="text-xs"
                        />
                        <Button variant="outline" size="sm" onClick={() => handleUpdate('approved')} disabled={isBusy}>Approve</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleUpdate('rejected')} disabled={isBusy || !adminNote}>Reject</Button>
                    </div>
                )}
                {claim.status === 'approved' && (
                    <div className="flex items-center gap-2">
                        <Input 
                            placeholder="Enter TX Hash from payout" 
                            value={txHash} 
                            onChange={(e) => setTxHash(e.target.value)}
                            className="font-mono text-xs"
                        />
                        <Button size="sm" onClick={() => handleUpdate('completed')} disabled={isBusy || !txHash}>Complete</Button>
                    </div>
                )}
                {claim.status === 'completed' && <p className="text-xs text-muted-foreground font-mono">TX: {claim.txHash}</p>}
                {claim.status === 'rejected' && <p className="text-xs text-muted-foreground">Note: {claim.adminNote}</p>}
            </TableCell>
        </TableRow>
    );
}

export default function AdminClaimsPage() {
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'claim_requests'), orderBy('requestedAt', 'desc'));
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const claimsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClaimRequest));
                setClaims(claimsData);
                setIsLoading(false);
            },
            (err) => {
                console.error("Error fetching claims:", err);
                setError("Failed to load claims. Check console for details.");
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck/> Admin: USDT Claim Requests</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p>Loading claims...</p>
                    ) : error ? (
                         <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : claims.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No claim requests found.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Creator ID</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Network</TableHead>
                                    <TableHead>Wallet Address</TableHead>
                                    <TableHead>Requested At</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {claims.map(claim => <ClaimRow key={claim.id} claim={claim} />)}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

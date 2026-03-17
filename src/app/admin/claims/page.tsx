
"use client"

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ClaimRequest } from '@/lib/types';
import { updateClaimRequestStatus } from '@/lib/ledger';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

function ClaimRow({ claim }: { claim: ClaimRequest }) {
    const { toast } = useToast();
    const [isBusy, setIsBusy] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [adminNote, setAdminNote] = useState('');

    const handleUpdate = async (status: ClaimRequest['status']) => {
        if (status === 'completed' && !txHash) {
            toast({ variant: 'destructive', title: 'Error', description: 'Transaction Hash is required.' });
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

    const getBadgeVariant = (status: ClaimRequest['status']) => {
        switch (status) {
            case 'pending': return 'secondary';
            case 'approved': return 'default';
            case 'completed': return 'success';
            case 'rejected': return 'destructive';
        }
    };

    return (
        <div className="border-b p-4 grid grid-cols-6 gap-4 items-center">
            <div className="font-mono text-xs truncate">{claim.creatorId}</div>
            <div>${claim.amount.toFixed(2)}</div>
            <div>{claim.network}</div>
            <div className="font-mono text-xs truncate">{claim.walletAddress}</div>
            <div><Badge variant={getBadgeVariant(claim.status)}>{claim.status}</Badge></div>
            <div className="space-y-2">
                {claim.status === 'pending' && (
                    <div className='flex gap-2'>
                        <Button size='sm' onClick={() => handleUpdate('approved')} disabled={isBusy}>Approve</Button>
                        <Input placeholder='Rejection note...' value={adminNote} onChange={e => setAdminNote(e.target.value)} className='h-9'/>
                        <Button size='sm' variant='destructive' onClick={() => handleUpdate('rejected')} disabled={isBusy || !adminNote}>Reject</Button>
                    </div>
                )}
                {claim.status === 'approved' && (
                    <div className='flex gap-2'>
                         <Input placeholder='Enter txHash...' value={txHash} onChange={e => setTxHash(e.target.value)} className='h-9'/>
                         <Button size='sm' onClick={() => handleUpdate('completed')} disabled={isBusy || !txHash}>Complete</Button>
                    </div>
                )}
                {claim.status === 'completed' && <a href={`https://tronscan.org/#/transaction/${claim.txHash}`} target='_blank' className='text-xs underline'>View Tx</a>}
                 {claim.status === 'rejected' && <p className='text-xs text-red-400 truncate'>Note: {claim.adminNote}</p>}
            </div>
        </div>
    );
}

export default function AdminClaimsPage() {
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'claim_requests'), orderBy('requestedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const claimsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClaimRequest));
            setClaims(claimsData);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className='max-w-7xl mx-auto py-8'>
            <Card className='glass-card'>
                <CardHeader>
                    <CardTitle>Claim Requests</CardTitle>
                    <CardDescription>Review and process USDT claim requests from creators.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border-t">
                        <div className="grid grid-cols-6 gap-4 p-4 font-bold text-sm text-muted-foreground">
                           <div>Creator ID</div>
                           <div>Amount</div>
                           <div>Network</div>
                           <div>Wallet Address</div>
                           <div>Status</div>
                           <div>Actions</div>
                        </div>
                        {isLoading ? (
                            <div className='text-center p-8'><Loader2 className='animate-spin mx-auto'/></div>
                        ) : claims.length === 0 ? (
                            <div className='text-center p-8 text-muted-foreground'>No claim requests found.</div>
                        ) : (
                            claims.map(claim => <ClaimRow key={claim.id} claim={claim} />)
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

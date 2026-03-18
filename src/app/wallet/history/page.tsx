
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, or, QuerySnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LedgerEntry, GroupedLedgerEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { LedgerEntryCard } from '@/components/ledger-entry-card';

const groupAndEnhanceHistory = (entries: LedgerEntry[], userId: string, walletAddress: string): GroupedLedgerEntry[] => {
    const grouped = new Map<string, GroupedLedgerEntry>();

    // Phase 1: Group entries by the most reliable key
    entries.forEach(entry => {
        let key: string;
        if (entry.type === 'ulc_purchase' && entry.txHash) {
            key = entry.txHash;
        } else {
            key = entry.referenceId || entry.id;
        }

        if (!grouped.has(key)) {
            grouped.set(key, { 
                id: key, 
                timestamp: entry.timestamp, 
                relatedEntries: [],
                mainEntry: entry // Placeholder
            });
        }
        const group = grouped.get(key)!;
        group.relatedEntries.push(entry);
        if(entry.timestamp > group.timestamp) group.timestamp = entry.timestamp; 
    });

    // Phase 2: Process each group to create a correct user-facing mainEntry
    for (const [key, group] of grouped.entries()) {
        const hasPremiumUnlock = group.relatedEntries.some(e => e.type === 'premium_unlock');
        const hasSubscription = group.relatedEntries.some(e => e.type === 'subscription_payment');
        const hasUlcPurchase = group.relatedEntries.some(e => e.type === 'ulc_purchase');

        if (hasPremiumUnlock || hasSubscription) {
            const transactionType = hasPremiumUnlock ? 'premium_unlock' : 'subscription_payment';
            const userDebits = group.relatedEntries.filter(
                e => (e.fromUserId === userId || e.fromWallet === walletAddress) && e.currency === 'ULC'
            );
            
            if (userDebits.length > 0) {
                const totalSpent = userDebits.reduce((sum, e) => sum + e.amount, 0);
                const representativeEntry = userDebits.find(e => e.type === transactionType) || userDebits[0];
                group.mainEntry = { ...representativeEntry, amount: totalSpent };
            } else {
                group.mainEntry = group.relatedEntries.find(e => e.type === transactionType) || group.relatedEntries[0];
            }
        } else if (hasUlcPurchase) {
            const usdtPayment = group.relatedEntries.find(e => e.currency === 'USDT');
            const ulcFulfillment = group.relatedEntries.find(e => e.currency === 'ULC' && e.type === 'ulc_purchase');
            
            if (usdtPayment && ulcFulfillment) {
                group.mainEntry = {
                    ...ulcFulfillment,
                    type: 'ulc_purchase_grouped',
                    amount: ulcFulfillment.amount,
                    metadata: { ...ulcFulfillment.metadata, usdtAmount: usdtPayment.amount }
                };
            } else {
                 group.mainEntry = group.relatedEntries[0];
            }
        } else {
            group.mainEntry = group.relatedEntries.sort((a,b) => b.timestamp - a.timestamp)[0];
        }

        group.relatedEntries.sort((a,b) => b.timestamp - a.timestamp);
    }
    
    const finalHistory = Array.from(grouped.values());
    return finalHistory.sort((a, b) => b.timestamp - a.timestamp);
};


function HistoryList({ history, user }: { history: GroupedLedgerEntry[], user: any }) {
    if (!user) return null;
    return (
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
             {history.length === 0 ? (
                <div className='text-center py-20'>
                    <History size={48} className="mx-auto text-muted-foreground" />
                    <p className='text-muted-foreground mt-4'>No transactions recorded yet.</p>
                </div>
             ) : (
                <div className="space-y-2">
                    {history.map(groupedEntry => (
                        <LedgerEntryCard key={groupedEntry.id} groupedEntry={groupedEntry} currentUser={user} />
                    ))}
                </div>
             )}
        </div>
    )
}

export default function TransactionHistoryPage() {
    const router = useRouter();
    const { user } = useWallet();
    const { toast } = useToast();
    const [history, setHistory] = useState<GroupedLedgerEntry[]>([]);

    useEffect(() => {
        if (!user?.uid || !user?.walletAddress) {
            setHistory([]);
            return;
        }

        const ledgerCollection = collection(db, 'ledger');
        const ledgerMap = new Map<string, LedgerEntry>();

        const processAndSetHistory = () => {
            const rawEntries = Array.from(ledgerMap.values());
            const groupedHistory = groupAndEnhanceHistory(rawEntries, user.uid, user.walletAddress);
            setHistory(groupedHistory);
        };
        
        const handleError = (error: Error) => {
            console.error("History snapshot error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch transaction history. Check console for details.' });
        };

        const processSnapshot = (snapshot: QuerySnapshot) => {
            snapshot.docs.forEach((doc) => {
                ledgerMap.set(doc.id, { ...doc.data(), id: doc.id } as LedgerEntry);
            });
            processAndSetHistory();
        };

        const queryByUserId = query(ledgerCollection, or(where('toUserId', '==', user.uid), where('fromUserId', '==', user.uid), where('creatorId', '==', user.uid)));
        const queryByToWallet = query(ledgerCollection, where('toWallet', '==', user.walletAddress));
        const queryByFromWallet = query(ledgerCollection, where('fromWallet', '==', user.walletAddress));

        const unsubscribes = [
            onSnapshot(queryByUserId, processSnapshot, handleError),
            onSnapshot(queryByToWallet, processSnapshot, handleError),
            onSnapshot(queryByFromWallet, processSnapshot, handleError),
        ];

        return () => unsubscribes.forEach(unsub => unsub());

    }, [user?.uid, user?.walletAddress, toast]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4">
            <header className="flex items-center justify-between pt-8">
                <div>
                    <h1 className="text-5xl font-headline font-bold gradient-text flex items-center gap-3"><History/> Transaction History</h1>
                    <p className="text-muted-foreground">A complete record of all your transactions.</p>
                </div>
                <Button onClick={() => router.push('/wallet')} variant="ghost"><ChevronLeft className="w-4 h-4 mr-2" /> Back to Wallet</Button>
            </header>
            <Card className="glass-card border-white/10">
                <CardContent className="pt-6">
                    <HistoryList history={history} user={user} />
                </CardContent>
            </Card>
        </div>
    );
}

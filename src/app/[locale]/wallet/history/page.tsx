
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
    const normalizedWallet = walletAddress?.toLowerCase();

    // Phase 1: Group entries
    entries.forEach(entry => {
        let key: string;
        // Group by txHash for purchases, or referenceId for everything else
        if (entry.txHash) {
            key = entry.txHash;
        } else if (entry.referenceId) {
            key = entry.referenceId;
        } else {
            key = entry.id;
        }

        if (!grouped.has(key)) {
            grouped.set(key, { 
                id: key, 
                timestamp: entry.timestamp, 
                relatedEntries: [],
                mainEntry: entry
            });
        }
        const group = grouped.get(key)!;
        group.relatedEntries.push(entry);
        if(entry.timestamp > group.timestamp) group.timestamp = entry.timestamp; 
    });

    // Phase 2: Process each group to create a correct user-facing mainEntry
    for (const [key, group] of grouped.entries()) {
        const hasPremiumUnlock = group.relatedEntries.some(e => e.type === 'premium_unlock');
        const hasSubscription = group.relatedEntries.some(e => ['subscription_payment', 'subscription_payment_usdt'].includes(e.type));
        const hasUlcPurchase = group.relatedEntries.some(e => ['ulc_purchase', 'ulc_purchase_grouped'].includes(e.type));
        const hasCreatorEarning = group.relatedEntries.some(e => e.type === 'creator_earning');

        if (hasPremiumUnlock || hasSubscription) {
            const transactionType = hasPremiumUnlock ? 'premium_unlock' : 'subscription_payment_usdt';
            // Find entries where the current user is the sender
            const userDebits = group.relatedEntries.filter(
                e => (e.fromUserId === userId || e.fromWallet?.toLowerCase() === normalizedWallet) && e.amount > 0
            );
            
            if (userDebits.length > 0) {
                const totalSpent = userDebits.reduce((sum, e) => sum + e.amount, 0);
                const representativeEntry = userDebits.find(e => e.type === transactionType) || userDebits[0];
                group.mainEntry = { ...representativeEntry, amount: totalSpent };
            } else {
                // If user is not the sender, they might be the receiver (creator)
                group.mainEntry = group.relatedEntries.find(e => e.type === 'creator_earning') || group.relatedEntries[0];
            }
        } else if (hasUlcPurchase) {
            const usdtEntry = group.relatedEntries.find(e => e.currency === 'USDT');
            const ulcEntry = group.relatedEntries.find(e => e.currency === 'ULC');
            
            if (usdtEntry && ulcEntry) {
                group.mainEntry = {
                    ...ulcEntry,
                    type: 'ulc_purchase',
                    amount: ulcEntry.amount,
                    metadata: { ...ulcEntry.metadata, usdtAmount: usdtEntry.amount }
                };
            } else {
                 group.mainEntry = group.relatedEntries[0];
            }
        } else if (hasCreatorEarning && group.relatedEntries.length === 1) {
            // Standalone earning
            group.mainEntry = group.relatedEntries[0];
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
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
             {history.length === 0 ? (
                <div className='text-center py-24'>
                    <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <History size={40} className="text-muted-foreground opacity-30" />
                    </div>
                    <p className='text-muted-foreground font-headline text-xl'>No transactions yet</p>
                    <p className='text-muted-foreground/60 text-sm mt-1'>Your financial journey starts here.</p>
                </div>
             ) : (
                <div className="space-y-3 pb-8">
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
    const { user, isConnected } = useWallet();
    const { toast } = useToast();
    const [history, setHistory] = useState<GroupedLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) {
            if (!isConnected) setLoading(false);
            return;
        }

        setLoading(true);
        const ledgerCollection = collection(db, 'ledger');
        const ledgerMap = new Map<string, LedgerEntry>();

        const processAndSetHistory = () => {
            const rawEntries = Array.from(ledgerMap.values());
            const groupedHistory = groupAndEnhanceHistory(rawEntries, user.uid, user.walletAddress);
            setHistory(groupedHistory);
            setLoading(false);
        };
        
        const handleError = (error: Error) => {
            console.error("History snapshot error:", error);
            setLoading(false);
        };

        const processSnapshot = (snapshot: QuerySnapshot) => {
            snapshot.docs.forEach((doc) => {
                ledgerMap.set(doc.id, { ...doc.data(), id: doc.id } as LedgerEntry);
            });
            processAndSetHistory();
        };

        // Comprehensive query to catch all relevant transactions
        const q = query(
            ledgerCollection, 
            or(
                where('toUserId', '==', user.uid), 
                where('fromUserId', '==', user.uid), 
                where('creatorId', '==', user.uid),
                where('fromWallet', '==', user.walletAddress),
                where('toWallet', '==', user.walletAddress)
            )
        );

        const unsub = onSnapshot(q, processSnapshot, handleError);
        return () => unsub();

    }, [user?.uid, user?.walletAddress, isConnected]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                 <History size={64} className="text-muted-foreground opacity-20" />
                 <h1 className="text-3xl font-headline font-bold">Connect Wallet</h1>
                 <p className="text-muted-foreground max-w-xs mx-auto">Please connect your wallet to view your transaction history.</p>
                 <Button onClick={() => router.push('/')}>Back to Home</Button>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20 px-4">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-10">
                <div className="space-y-1">
                    <h1 className="text-5xl font-headline font-bold gradient-text flex items-center gap-4">
                        <History className="w-10 h-10 text-primary" /> History
                    </h1>
                    <p className="text-muted-foreground font-medium">Your sovereign financial ledger on Unverse.</p>
                </div>
                <Button onClick={() => router.push('/wallet')} variant="ghost" className="rounded-full bg-white/5 hover:bg-white/10 h-12 px-6">
                    <ChevronLeft className="w-4 h-4 mr-2" /> Back to Wallet
                </Button>
            </header>

            {loading && history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-headline animate-pulse">Syncing Ledger...</p>
                </div>
            ) : (
                <Card className="glass-card border-white/10 shadow-2xl overflow-hidden">
                    <CardContent className="p-6">
                        <HistoryList history={history} user={user} />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

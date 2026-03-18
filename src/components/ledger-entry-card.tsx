
"use client";

import { useState, useEffect } from 'react';
import { LedgerEntry, UserProfile, ContentPost, GroupedLedgerEntry } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Coins, ArrowDownLeft, ArrowUpRight, ExternalLink, ChevronsRight, ChevronsDown } from 'lucide-react';
import { getTxUrl, formatAddress } from '@/lib/utils';

// --- Caching helpers (no changes) ---
const userCache = new Map<string, UserProfile>();
const fetchUser = async (uid: string): Promise<UserProfile | null> => {
    if (userCache.has(uid)) return userCache.get(uid)!;
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            userCache.set(uid, userData);
            return userData;
        }
    } catch (error) {
        console.error("Error fetching user:", error);
    }
    return null;
};

const postCache = new Map<string, ContentPost>();
const fetchPost = async (postId: string): Promise<ContentPost | null> => {
    if (postCache.has(postId)) return postCache.get(postId)!;
    try {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
            const postData = postDoc.data() as ContentPost;
            postCache.set(postId, postData);
            return postData;
        }
    } catch (error) {
        console.error("Error fetching post:", error);
    }
    return null;
};


const LedgerEntryDetails = ({ entry, currentUser, relatedEntries }: { entry: LedgerEntry, currentUser: UserProfile, relatedEntries: LedgerEntry[] }) => {
    const [relatedUser, setRelatedUser] = useState<UserProfile | null>(null);
    const [relatedPost, setRelatedPost] = useState<ContentPost | null>(null);

    const userIsSender = entry.fromUserId === currentUser.uid || entry.fromWallet === currentUser.walletAddress;

    useEffect(() => {
        let isMounted = true;
        const fetchRelatedData = async () => {
            if (entry.type === 'internal_ulc_transfer' || entry.type === 'subscription_payment' || entry.type === 'creator_earning') {
                const otherUserId = userIsSender ? entry.toUserId : entry.fromUserId;
                if (otherUserId) fetchUser(otherUserId).then(user => isMounted && setRelatedUser(user));
            }
            if (entry.type === 'premium_unlock' && entry.metadata?.postId) {
                fetchPost(entry.metadata.postId).then(post => isMounted && setRelatedPost(post));
            }
        };

        fetchRelatedData();
        return () => { isMounted = false; };
    }, [entry, currentUser.uid, userIsSender]);

    const getInfo = () => {
        switch (entry.type) {
            // GROUPED TYPES
            case 'ulc_purchase_grouped':
                const usdtAmount = entry.metadata?.usdtAmount || 0;
                return { title: 'ULC Purchase', description: `Bought ULC with ${usdtAmount.toFixed(2)} USDT` };
            case 'premium_unlock':
                 return { title: 'Premium Unlock', description: `Unlocked: ${relatedPost?.title || 'a premium post'}` };
            // REGULAR TYPES
            case 'subscription_payment':
                return { title: 'Subscription Payment', description: `Subscribed to ${relatedUser?.username || 'a creator'}` };
            case 'creator_earning':
                return { title: 'Creator Earning', description: `From ${relatedUser?.username || 'a user'}'s subscription` };
            case 'creator_claim_executed':
                return { title: 'Claim Completed', description: 'USDT claim processed by admin' };
            case 'internal_ulc_transfer':
                if (userIsSender) return { title: 'Internal Transfer', description: `Sent ULC to ${relatedUser?.username || formatAddress(entry.toWallet)}` };
                return { title: 'Internal Transfer', description: `Received ULC from ${relatedUser?.username || formatAddress(entry.fromWallet)}` };
            case 'welcome_bonus':
                return { title: 'Welcome Bonus', description: 'One-time joining bonus' };
            default:
                return { title: entry.type.replace(/_/g, ' ').toUpperCase(), description: entry.memo || 'General transaction' };
        }
    };

    const { title, description } = getInfo();

    return (
        <div>
            <p className='font-semibold'>{title}</p>
            <p className='text-sm text-muted-foreground'>{description}</p>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-x-3 flex-wrap">
                {entry.network && <span>{entry.network}</span>}
                 {entry.txHash && 
                    <a href={getTxUrl(entry.txHash, entry.network)} target='_blank' rel='noopener noreferrer' className='text-blue-400 hover:underline flex items-center gap-1'>
                        Tx: {formatAddress(entry.txHash)}
                        <ExternalLink size={12}/>
                    </a>
                }
            </div>
        </div>
    );
};

export const LedgerEntryCard = ({ groupedEntry, currentUser }: { groupedEntry: GroupedLedgerEntry, currentUser: UserProfile }) => {
    const { mainEntry, relatedEntries } = groupedEntry;
    const [isExpanded, setIsExpanded] = useState(false);

    // Determine direction and color from the MAIN entry
    const isCreatorClaim = currentUser.isCreator && mainEntry.creatorId === currentUser.uid && mainEntry.type === 'creator_claim_executed';
    const isIncoming = (mainEntry.toUserId === currentUser.uid || mainEntry.toWallet === currentUser.walletAddress || isCreatorClaim || mainEntry.type === 'ulc_purchase_grouped');
    const isOutgoing = (mainEntry.fromUserId === currentUser.uid || mainEntry.fromWallet === currentUser.walletAddress) && !isIncoming;
    
    const color = isIncoming ? 'text-green-400' : isOutgoing ? 'text-red-400' : 'text-gray-500';
    const sign = isIncoming ? '+' : isOutgoing ? '-' : '';
    const Icon = isIncoming ? ArrowDownLeft : isOutgoing ? ArrowUpRight : Coins;
    const canExpand = relatedEntries.length > 1 && (mainEntry.type === 'premium_unlock' || mainEntry.type === 'ulc_purchase_grouped');

    return (
        <div className="rounded-md bg-background/50 hover:bg-background/90 transition-colors duration-300">
            <div className='flex items-center justify-between p-3 cursor-pointer' onClick={() => canExpand && setIsExpanded(!isExpanded)}>
                <div className='flex items-center gap-4'>
                    <div className={`p-2 rounded-full bg-slate-800 ${color}`}><Icon size={16} /></div>
                    <LedgerEntryDetails entry={mainEntry} currentUser={currentUser} relatedEntries={relatedEntries} />
                </div>
                <div className='text-right flex-shrink-0 pl-4'>
                    <p className={`font-bold text-lg ${color}`}>{sign}{(mainEntry.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {mainEntry.currency}</p>
                    <p className='text-xs text-muted-foreground'>{new Date(mainEntry.timestamp).toLocaleString()}</p>
                </div>
                 {canExpand && (isExpanded ? <ChevronsDown size={16} className="ml-2 text-muted-foreground"/> : <ChevronsRight size={16} className="ml-2 text-muted-foreground"/>)}
            </div>
            {/* EXPANDED VIEW */}
            {isExpanded && canExpand && (
                <div className="px-4 pb-3 ml-12 border-l border-dashed border-slate-700">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Breakdown:</p>
                    <div className="space-y-1">
                         {relatedEntries.map(e => (
                            <div key={e.id} className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">{e.memo || e.type}</span>
                                <span className="font-mono">{(e.amount).toFixed(2)} {e.currency}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { processUniqProUnlockServer } from '@/lib/ledger-server';

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        
        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const ledgerId = await processUniqProUnlockServer(userId);

        return NextResponse.json({ 
            success: true, 
            ledgerId 
        });

    } catch (error: any) {
        console.error('PRO UNLOCK ERROR:', error);
        
        if (error.message === 'ALREADY_UNLOCKED') {
            return NextResponse.json({ error: 'You have already unlocked Uniq Pro.' }, { status: 400 });
        }
        
        if (error.message === 'INSUFFICIENT_ULC') {
            return NextResponse.json({ error: 'Insufficient ULC balance. 15 ULC required.' }, { status: 402 });
        }

        return NextResponse.json({ 
            error: error.message || 'Unlock failed.' 
        }, { status: 500 });
    }
}

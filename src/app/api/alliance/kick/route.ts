import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { allianceId, targetWallet, ownerAddress } = await req.json();

        if (!allianceId || !targetWallet || !ownerAddress) {
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }

        // 1. Verify Ownership
        const allianceRef = adminDb.doc(`alliances/${allianceId}`);
        const allianceSnap = await allianceRef.get();
        if (!allianceSnap.exists || allianceSnap.data()?.founderAddress !== ownerAddress) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Only the founder can kick members.' }, { status: 403 });
        }

        if (targetWallet === ownerAddress) {
            return NextResponse.json({ success: false, error: 'Cannot kick yourself. Use Leave or Disband.' }, { status: 400 });
        }

        const memberRef = adminDb.collection('alliance_members').doc(`${allianceId}_${targetWallet}`);
        const memberSnap = await memberRef.get();

        if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Member not found or already inactive' }, { status: 404 });
        }

        const batch = adminDb.batch();

        // Soft delete target
        batch.update(memberRef, {
            status: 'kicked',
            kickedAt: Date.now()
        });

        // Decrement member count
        batch.update(allianceRef, {
            memberCount: FieldValue.increment(-1)
        });

        await batch.commit();
        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

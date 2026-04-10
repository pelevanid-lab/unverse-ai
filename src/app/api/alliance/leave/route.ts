import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { allianceId, walletAddress } = await req.json();

        if (!allianceId || !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const memberRef = adminDb.collection('alliance_members').doc(`${allianceId}_${walletAddress}`);
        const memberSnap = await memberRef.get();

        if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Membership not found or already inactive' }, { status: 404 });
        }

        const memberData = memberSnap.data()!;
        const allianceRef = adminDb.doc(`alliances/${allianceId}`);
        const allianceSnap = await allianceRef.get();

        if (!allianceSnap.exists) {
            return NextResponse.json({ success: false, error: 'Alliance not found' }, { status: 404 });
        }

        // Owner protection: If owner leaves and they are the only member, alliance is deleted or needs transfer.
        // For simplicity: Owners cannot leave if they are the only member, except via 'disband' (pending implementation).
        if (memberData.role === 'owner' && allianceSnap.data()?.memberCount > 1) {
            return NextResponse.json({ success: false, error: 'As an owner, you must transfer leadership before leaving a multi-member alliance.' }, { status: 403 });
        }

        const batch = adminDb.batch();

        // 1. Soft delete membership (set to left/inactive)
        batch.update(memberRef, {
            status: 'left',
            leftAt: Date.now()
        });

        // 2. Decrement member count
        batch.update(allianceRef, {
            memberCount: FieldValue.increment(-1)
        });

        await batch.commit();

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[alliance-leave] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const { allianceId, ownerAddress } = await req.json();

        if (!allianceId || !ownerAddress) {
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }

        // 1. Verify Ownership
        const allianceRef = adminDb.doc(`alliances/${allianceId}`);
        const allianceSnap = await allianceRef.get();
        if (!allianceSnap.exists || allianceSnap.data()?.founderAddress !== ownerAddress) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Only the founder can disband the alliance.' }, { status: 403 });
        }

        // 2. Fetch all active members to update them
        const membersSnap = await adminDb
            .collection('alliance_members')
            .where('allianceId', '==', allianceId)
            .where('status', '==', 'active')
            .get();

        const batch = adminDb.batch();

        // Mark all members as 'disbanded'
        membersSnap.docs.forEach(doc => {
            batch.update(doc.ref, { 
                status: 'disbanded',
                disbandedAt: Date.now()
            });
        });

        // Delete alliance (or soft delete)
        batch.delete(allianceRef);

        await batch.commit();
        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

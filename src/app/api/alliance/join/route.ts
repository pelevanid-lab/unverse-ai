import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_MEMBERS = 16;

export async function POST(req: NextRequest) {
    try {
        const { allianceId, walletAddress, inviteCode } = await req.json();

        if (!allianceId || !walletAddress) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Get Alliance
        const allianceRef = adminDb.doc(`alliances/${allianceId}`);
        const allianceSnap = await allianceRef.get();
        if (!allianceSnap.exists) {
            return NextResponse.json({ success: false, error: 'Alliance not found' }, { status: 404 });
        }
        const alliance = allianceSnap.data()!;

        // 2. Member Limit Check
        if (alliance.memberCount >= MAX_MEMBERS) {
            return NextResponse.json({ success: false, error: `Alliance reached its max capacity of ${MAX_MEMBERS} hunters.` }, { status: 400 });
        }

        // 3. Status check (Public vs Invite)
        if (!alliance.isPublic && alliance.inviteCode !== inviteCode) {
            return NextResponse.json({ success: false, error: 'Invalid invite code for this private alliance.' }, { status: 403 });
        }

        // 4. Overlap Check
        const memberCheck = await adminDb
            .collection('alliance_members')
            .where('walletAddress', '==', walletAddress)
            .where('status', '==', 'active')
            .get();
        if (!memberCheck.empty) {
            return NextResponse.json({ success: false, error: 'You are already a member of another alliance.' }, { status: 400 });
        }

        // 5. Entry Fee Check (Hypothetical, can be added later)
        // For now, free to join if above checks pass.

        const batch = adminDb.batch();

        // Add Membership
        const memberRef = adminDb.collection('alliance_members').doc(`${allianceId}_${walletAddress}`);
        batch.set(memberRef, {
            allianceId,
            walletAddress,
            contributionScore: 0,
            joinedAt: Date.now(),
            lastActiveAt: Date.now(),
            status: 'active',
            totalRewardEarned: 0,
            role: 'member',
        });

        // Increment Alliance member count
        batch.update(allianceRef, {
            memberCount: FieldValue.increment(1)
        });

        await batch.commit();

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[alliance-join] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

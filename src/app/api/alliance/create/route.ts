import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { name, symbol, isPublic, entryFeeULC, founderAddress } = await req.json();

        if (!name || !symbol || !founderAddress) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 🛡️ ANTI-SPAM: Founder must have found at least 1 chest to lead an alliance
        const attemptsSnap = await adminDb
            .collection('chest_attempts')
            .where('hunterAddress', '==', founderAddress)
            .where('isCorrect', '==', true)
            .limit(1)
            .get();

        if (attemptsSnap.empty) {
            return NextResponse.json({ 
                success: false, 
                error: 'Clearance required: You must solve at least one treasure chest before founding an alliance.' 
            }, { status: 403 });
        }

        // Check for existing name/symbol
        const nameCheck = await adminDb.collection('alliances').where('name', '==', name).get();
        if (!nameCheck.empty) {
            return NextResponse.json({ success: false, error: 'Alliance name already taken' }, { status: 400 });
        }
        const symbolCheck = await adminDb.collection('alliances').where('symbol', '==', symbol.toUpperCase()).get();
        if (!symbolCheck.empty) {
            return NextResponse.json({ success: false, error: 'Alliance symbol already taken' }, { status: 400 });
        }

        // Check if user is already in an alliance
        const memberCheck = await adminDb
            .collection('alliance_members')
            .where('walletAddress', '==', founderAddress)
            .where('status', '==', 'active')
            .get();
        if (!memberCheck.empty) {
            return NextResponse.json({ success: false, error: 'You are already a member of another alliance' }, { status: 400 });
        }

        const allianceRef = adminDb.collection('alliances').doc();
        const allianceId = allianceRef.id;

        const batch = adminDb.batch();

        // 1. Create Alliance
        batch.set(allianceRef, {
            name,
            symbol: symbol.toUpperCase(),
            founderAddress,
            isPublic: isPublic ?? true,
            entryFeeULC: entryFeeULC ?? 0,
            treasuryBalance: 0,
            totalChestsFound: 0,
            totalRewardULC: 0,
            memberCount: 1,
            createdAt: Date.now(),
        });

        // 2. Create the Founder's Membership
        const memberRef = adminDb.collection('alliance_members').doc(`${allianceId}_${founderAddress}`);
        batch.set(memberRef, {
            allianceId,
            walletAddress: founderAddress,
            contributionScore: 0,
            joinedAt: Date.now(),
            lastActiveAt: Date.now(),
            status: 'active',
            totalRewardEarned: 0,
            role: 'owner', // Added role for management
        });

        await batch.commit();

        return NextResponse.json({ success: true, allianceId });

    } catch (error: any) {
        console.error('[alliance-create] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

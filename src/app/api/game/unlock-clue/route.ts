import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { processClueUnlock } from '@/lib/treasure-engine';
import { addContributionScore, CONTRIBUTION_POINTS } from '@/lib/alliance-engine';
import { GameSession, TreasureChest, Clue } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { sessionId, clueOrder } = await req.json();

        if (!sessionId || clueOrder === undefined) {
            return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }

        // Load session
        const sessionDoc = await adminDb.doc(`game_sessions/${sessionId}`).get();
        if (!sessionDoc.exists) {
            return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
        }
        const session = { id: sessionDoc.id, ...sessionDoc.data() } as GameSession;

        if (session.status !== 'active') {
            return NextResponse.json({ success: false, error: 'Session is not active' });
        }

        // Already unlocked?
        if ((session.cluesUnlocked || []).includes(clueOrder)) {
            // Return the clue text again (already paid)
            const chestDoc = await adminDb.doc(`chests/${session.chestId}`).get();
            const chest = chestDoc.data() as TreasureChest;
            const clue = chest.clues.find(c => c.order === clueOrder);
            return NextResponse.json({ success: true, clueText: clue?.text });
        }

        // Load chest
        const chestDoc = await adminDb.doc(`chests/${session.chestId}`).get();
        if (!chestDoc.exists) {
            return NextResponse.json({ success: false, error: 'Chest not found' }, { status: 404 });
        }
        const chest = { id: chestDoc.id, ...chestDoc.data() } as TreasureChest;
        const clue = chest.clues.find((c: Clue) => c.order === clueOrder);

        if (!clue) {
            return NextResponse.json({ success: false, error: 'Clue not found' }, { status: 404 });
        }

        if (clue.costULC > 0) {
            // Check user balance
            const userDoc = await adminDb.doc(`users/${session.hunterAddress}`).get();
            if (!userDoc.exists) {
                return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
            }
            const userData = userDoc.data();
            const available = userData?.ulcBalance?.available ?? 0;

            if (available < clue.costULC) {
                return NextResponse.json({ success: false, error: 'INSUFFICIENT_BALANCE' });
            }

            // Process burn via admin db directly (avoids client-side firebase)
            const burnAmount = Math.floor(clue.costULC * clue.burnRatio);
            const treasuryAmount = clue.costULC - burnAmount;

            const batch = adminDb.batch();

            // Deduct balance
            batch.update(adminDb.doc(`users/${session.hunterAddress}`), {
                'ulcBalance.available': FieldValue.increment(-clue.costULC),
            });

            // Burn ledger entry
            if (burnAmount > 0) {
                batch.set(adminDb.collection('ledger').doc(), {
                    fromWallet: session.hunterAddress,
                    fromUserId: session.hunterAddress,
                    amount: burnAmount,
                    currency: 'ULC',
                    type: 'clue_unlock_burn',
                    memo: `Clue ${clueOrder} unlock: chest ${session.chestId}`,
                    referenceId: session.chestId,
                    timestamp: Date.now(),
                });
            }

            // Update session
            batch.update(adminDb.doc(`game_sessions/${sessionId}`), {
                cluesUnlocked: FieldValue.arrayUnion(clueOrder),
                lastActiveAt: Date.now(),
            });

            await batch.commit();

            // Contribution score
            if (session.allianceId) {
                await addContributionScore(
                    session.hunterAddress,
                    session.allianceId,
                    CONTRIBUTION_POINTS.CLUE_UNLOCK
                );
            }
        } else {
            // Free clue — just record in session
            await adminDb.doc(`game_sessions/${sessionId}`).update({
                cluesUnlocked: FieldValue.arrayUnion(clueOrder),
                lastActiveAt: Date.now(),
            });
        }

        return NextResponse.json({ success: true, clueText: clue.text });

    } catch (error: any) {
        console.error('[unlock-clue] Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { validateAnswer, distributeTreasureReward, processClueUnlock } from '@/lib/treasure-engine';
import { onChestOpened } from '@/lib/difficulty-engine';
import { addContributionScore, CONTRIBUTION_POINTS } from '@/lib/alliance-engine';
import { TreasureChest, GameSession } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const { sessionId, chestId, answer } = await req.json();

        if (!sessionId || !chestId || !answer) {
            return NextResponse.json({ correct: false, error: 'Missing fields' }, { status: 400 });
        }

        if (typeof answer !== 'string' || answer.length > 500) {
            return NextResponse.json({ correct: false, error: 'Invalid answer' }, { status: 400 });
        }

        // Rate limiting: max 10 attempts per session
        const attemptsSnap = await adminDb
            .collection('chest_attempts')
            .where('chestId', '==', chestId)
            .where('hunterAddress', '==', sessionId) // sessionId resolves to wallet
            .get();

        const recentAttempts = attemptsSnap.docs.filter(
            d => Date.now() - d.data().timestamp < 60 * 60 * 1000
        );
        if (recentAttempts.length >= 10) {
            return NextResponse.json({ correct: false, error: 'Too many attempts. Try again in an hour.' }, { status: 429 });
        }

        // Load session
        const sessionDoc = await adminDb.doc(`game_sessions/${sessionId}`).get();
        if (!sessionDoc.exists) {
            return NextResponse.json({ correct: false, error: 'Session not found' }, { status: 404 });
        }
        const session = { id: sessionDoc.id, ...sessionDoc.data() } as GameSession;

        // Load chest with answerHash (admin DB has full data)
        const chestDoc = await adminDb.doc(`chests/${chestId}`).get();
        if (!chestDoc.exists) {
            return NextResponse.json({ correct: false, error: 'Chest not found' }, { status: 404 });
        }
        const chest = { id: chestDoc.id, ...chestDoc.data() } as TreasureChest;

        // Already solved check
        if (session.status === 'solved') {
            return NextResponse.json({ correct: true, alreadySolved: true });
        }

        // Validate answer
        const isCorrect = validateAnswer(answer, chest.answerHash);

        // 🛡️ ANTI-CHEAT: Temporal Protection (Min 20s per chest solve)
        const solveTimeMs = Date.now() - session.startedAt;
        const isSuspiciouslyFast = isCorrect && solveTimeMs < 20000; // 20 seconds threshold

        // 🛡️ BRUTE-FORCE PENALTY: 1 ULC burn for failed attempts on top-tier chests
        const needsPenalty = !isCorrect && ['legendary', 'genesis'].includes(chest.rarity);
        let penaltySuccess = true;

        if (needsPenalty) {
            try {
                const hunterRef = adminDb.doc(`users/${session.hunterAddress}`);
                const hunterSnap = await hunterRef.get();
                const balance = hunterSnap.data()?.ulcBalance?.available || 0;
                
                if (balance > 0) {
                    await hunterRef.update({
                        'ulcBalance.available': FieldValue.increment(-1),
                        totalSpent: FieldValue.increment(1)
                    });
                    // Log the burn penalty in ledger
                    await adminDb.collection('ledger').add({
                        fromUserId: session.hunterAddress,
                        amount: 1,
                        currency: 'ULC',
                        type: 'failed_attempt_burn',
                        memo: `Penalty: Wrong guess on ${chest.rarity} chest ${chestId}`,
                        referenceId: chestId,
                        timestamp: Date.now(),
                    });
                } else {
                    penaltySuccess = false; // Cannot even try if balance is 0 and it's high-tier
                }
            } catch (err) {
                console.error('Penalty processing error:', err);
            }
        }

        if (needsPenalty && !penaltySuccess) {
            return NextResponse.json({ 
                correct: false, 
                error: 'Insufficient Hunting Credits. High-tier chests require 1 ULC stake per attempt to prevent signal spam.' 
            }, { status: 403 });
        }

        // Record attempt
        await adminDb.collection('chest_attempts').add({
            chestId,
            universeId: chest.universeId,
            hunterAddress: session.hunterAddress,
            allianceId: session.allianceId || null,
            answer: answer.substring(0, 200),
            isCorrect,
            ulcBurned: needsPenalty ? 1 : 0,
            solveTimeMs: isCorrect ? solveTimeMs : null,
            timestamp: Date.now(),
            isSuspicious: isSuspiciouslyFast
        });

        // Log suspicious solve
        if (isSuspiciouslyFast) {
            await adminDb.collection('security_logs').add({
                type: 'ULTRA_FAST_SOLVE',
                hunterAddress: session.hunterAddress,
                chestId,
                solveTimeMs,
                timestamp: Date.now()
            });
        }

        if (!isCorrect) {
            return NextResponse.json({ correct: false, penaltyApplied: needsPenalty });
        }

        // ✅ CORRECT — determine if first hunter
        const isFirstHunter = chest.status === 'sealed' || chest.status === 'hunted';

        // Distribute reward
        const { rewardULC, nftName } = await distributeTreasureReward({
            chestId,
            hunterAddress: session.hunterAddress,
            sessionId,
            isFirstHunter,
            allianceId: session.allianceId,
        });

        // Update difficulty engine
        if (isFirstHunter) {
            const activeSnap = await adminDb
                .collection('game_sessions')
                .where('status', '==', 'active')
                .get();
            await onChestOpened(activeSnap.size);
        }

        // Contribution score for alliance (answering = +50)
        if (session.allianceId) {
            await addContributionScore(
                session.hunterAddress,
                session.allianceId,
                isFirstHunter
                    ? CONTRIBUTION_POINTS.CHEST_OPENER + CONTRIBUTION_POINTS.CORRECT_SUBANSWER
                    : CONTRIBUTION_POINTS.CORRECT_SUBANSWER
            );
        }

        return NextResponse.json({
            correct: true,
            isFirstHunter,
            rewardULC,
            nftName: isFirstHunter ? nftName : undefined,
        });

    } catch (error: any) {
        console.error('[submit-answer] Error:', error);
        return NextResponse.json({ correct: false, error: 'Server error' }, { status: 500 });
    }
}

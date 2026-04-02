import { NextResponse } from 'next/server';
import { 
    recordUsdcSubscriptionServer, 
    grantWelcomeBonusServer, 
    handleStakingServer, 
    handleUnstakingServer,
    processAiGenerationPaymentServer,
    refundAiGenerationPaymentServer,
    processAiCreatorActivationServer,
    processAiCreatorGenerationServer,
    processUniqProUnlockServer,
    processUniqTwinUnlockServer
} from '@/lib/ledger-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, userId, payload } = body;

        if (!action || !userId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        switch (action) {
            case 'RECORD_SUBSCRIPTION':
                await recordUsdcSubscriptionServer(
                    userId, 
                    payload.creatorId, 
                    payload.network, 
                    payload.txHash
                );
                break;
            
            case 'GRANT_WELCOME_BONUS':
                await grantWelcomeBonusServer(userId);
                break;

            case 'STAKE':
                await handleStakingServer(userId, payload.amount);
                break;

            case 'UNSTAKE':
                await handleUnstakingServer(userId, payload.amount);
                break;

            case 'AI_GENERATION_PAYMENT':
                const ledgerId = await processAiGenerationPaymentServer(
                    userId, 
                    payload.cost, 
                    payload.isRegeneration
                );
                return NextResponse.json({ success: true, ledgerId });

            case 'AI_GENERATION_REFUND':
                await refundAiGenerationPaymentServer(
                    userId, 
                    payload.ledgerId, 
                    payload.cost
                );
                break;

            case 'AI_CREATOR_ACTIVATION':
                const activationId = await processAiCreatorActivationServer(userId);
                return NextResponse.json({ success: true, ledgerId: activationId });

            case 'AI_CREATOR_GENERATION':
                const genId = await processAiCreatorGenerationServer(userId);
                return NextResponse.json({ success: true, ledgerId: genId });

            case 'UNIQ_PRO_UNLOCK':
                const unlockId = await processUniqProUnlockServer(userId);
                return NextResponse.json({ success: true, ledgerId: unlockId });

            case 'UNIQ_TWIN_UNLOCK':
                const twinUnlockId = await processUniqTwinUnlockServer(userId, payload.path);
                return NextResponse.json({ success: true, ledgerId: twinUnlockId });

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error(`Ledger execution error:`, error);
        return NextResponse.json({ 
            error: error.message || "Internal server error" 
        }, { status: 500 });
    }
}

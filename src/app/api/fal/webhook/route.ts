import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const json = await req.json();
        
        // Example fal payload format:
        // {
        //   request_id: "...",
        //   status: "IN_PROGRESS" | "COMPLETED" | "FAILED",
        //   payload: { diffusers_lora_file: { url: "..." } } 
        // }
        const { request_id, status, payload, error } = json;

        // Parse query params to get user id
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId in url query' }, { status: 400 });
        }

        const userRef = adminDb.collection('users').doc(userId);
        
        if (status === 'IN_PROGRESS') {
            await userRef.update({
                'uniq.neural_progress': 50 // Middle of training
            });
        } 
        else if (status === 'COMPLETED') {
            // Found LoRA URL! 
            // Payload structure depends on the exact model returned by fal.
            // For flux-lora-fast-training, it's usually { diffusers_lora_file: { url: "..." } }
            const loraUrl = payload?.diffusers_lora_file?.url || payload?.output_file?.url || payload?.url;

            if (loraUrl) {
                await userRef.update({
                    'uniq.neural_progress': 100,
                    'uniq.twin_status': 'ready',
                    'uniq.lora_url': loraUrl,
                    'uniq.trigger_word': 'TOK' // Default for our trainer
                });
                console.log(`[FalWebhook] LoRA Success for ${userId}: ${loraUrl}`);
            } else {
                console.error(`[FalWebhook] COMPLETED but no LoRA URL found in payload:`, JSON.stringify(payload));
                // Keep progress at 99 or similar if we are unsure? No, mark as failed if no URL.
                await userRef.update({
                    'uniq.neural_progress': 0,
                    'uniq.twin_status': 'learning' 
                });
            }
        } 
        else if (status === 'FAILED') {
            console.error(`Fal training failed for user ${userId}:`, error);
            await userRef.update({
                'uniq.neural_progress': 0,
                'uniq.twin_status': 'learning' // Let them try again
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Fal Webhook Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

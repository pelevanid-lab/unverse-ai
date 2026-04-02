import { NextResponse } from 'next/server';
import { initiateLoRATraining, initiateImaginaryCharacterGeneration } from '@/lib/neural-learning';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const json = await req.json();
        const { userId, type, imageUrls, prompt } = json;

        if (!userId || !type) {
             return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Verify user unlocked twin path
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new Error("User not found");
        
        const userData = userDoc.data();
        if (!userData?.uniq?.unlocked) {
             throw new Error("Digital Twin engine not unlocked. Please visit the Uniq page.");
        }

        if (userData.uniq.twin_status === 'training') {
             throw new Error("A LoRA training is already in progress.");
        }

        // 2. Route based on type
        if (type === 'photos') {
             if (!imageUrls || imageUrls.length < 15) {
                 throw new Error("Must provide at least 15 photos.");
             }
             // Start process
             await initiateLoRATraining(userId, imageUrls, 'TOK');
        } 
        else if (type === 'imaginary') {
             if (!prompt || prompt.length < 10) {
                 throw new Error("Must provide a detailed character prompt.");
             }
             // Start generating refs -> then training
             // We return early because this might take 30s+, Vercel might timeout.
             // Actually, we can trigger the async generation in the background
             // But for serverless, it's safer to await or trigger a real background job.
             // We'll await it for now; `flux/schnell` should complete 15 images in ~10 seconds using promises.
             await initiateImaginaryCharacterGeneration(userId, prompt);
        } else {
             throw new Error("Invalid training type");
        }

        return NextResponse.json({ success: true, status: 'training_started' });

    } catch (e: any) {
         console.error('Neural Training start failed:', e);
         return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

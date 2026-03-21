
import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { processAiGenerationPayment, refundAiGenerationPayment } from '@/lib/ledger';

export async function POST(req: Request) {
  let ledgerId: string | null = null;
  let userIdForRefund: string | null = null;
  let cost = 5; // Moved cost definition outside try block

  try {
    const json = await req.json();
    const { prompt, enhancedPrompt, negativePrompt, userId, image, mask } = json;
    cost = json.cost || 5; // Assign cost from json, default to 5

    if (!prompt || !userId) {
      return NextResponse.json({ error: 'Prompt and userId are required' }, { status: 400 });
    }

    userIdForRefund = userId;

    // 1. Process Payment (Deduct 3 ULC)
    try {
        ledgerId = await processAiGenerationPayment(userId, cost);
    } catch (payErr: any) {
        if (payErr.message === 'INSUFFICIENT_ULC') {
            return NextResponse.json({ error: `Not enough ULC. This action costs ${cost} ULC.` }, { status: 402 });
        }
        throw payErr;
    }

    // Server-side check of the token
    const rawToken = process.env.REPLICATE_API_TOKEN;
    if (!rawToken) {
      throw new Error('Replicate API token is missing on the server.');
    }

    // Initialize Replicate
    const replicate = new Replicate({
      auth: rawToken.trim(),
    });

    // 2. Call AI Generation using the ENHANCED prompt
    const finalPromptForAI = enhancedPrompt || prompt;
    
    let model: any = "black-forest-labs/flux-schnell";
    let input: any = {
      prompt: finalPromptForAI,
      aspect_ratio: "1:1",
      negative_prompt: negativePrompt || undefined,
    };

    if (image && cost === 5) {
        // Upgrade Standard mode to Dev-Img2Img if a reference is provided
        model = "lucataco/flux-dev-img2img:cc9f0f970baaa9d00927e1a329d9fdc4eb2244a56c3216c52a0889c162590740";
        input = {
            prompt: finalPromptForAI,
            image: image,
            prompt_strength: 0.8,
            num_inference_steps: 28,
            guidance_scale: 3.5
        };
    }

    // Digital Twin specialized model (Identity Preservation)
    if (cost === 20 && image) {
      model = "lucataco/flux-pulid-ca:46914902357738f15b812f862fe57d079983ed758d4a675034c56fd5767c6999";
      input = {
        prompt: finalPromptForAI,
        main_face_image: image,
        negative_prompt: (negativePrompt ? negativePrompt + ", " : "") + "bad quality, blurry, distorted face, unrealistic, woman if reference is man, person change",
        id_weight: 1,
        num_inference_steps: 20
      };
    } else if (cost === 3 && image) {
      // AI Edit / In-painting specialized model
      model = "black-forest-labs/flux-fill";
      input = {
        prompt: finalPromptForAI,
        image: image,
        mask: mask || image, // Fallback to image if no mask (global edit)
        guidance: 30,
        num_inference_steps: 20
      };
    }

    const output = await replicate.run(model, { input }) as string[];

    if (!output || !output[0]) {
        throw new Error("AI returned empty output.");
    }

    const imageUrl = output[0];
    
    // 3. Storage & DB persistence
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from Replicate: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    const fileName = `ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const imagePath = `creator-media/${userId}/${fileName}`;
    const storageRef = ref(storage, imagePath);
    await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/png' });
    const finalUrl = await getDownloadURL(storageRef);

    // Save logic removed from here as per user request (no auto-save to pool)
    // The previous addDoc call to 'creator_media' has been removed.

    // 🚀 NEW: Create entry in ai_generation_logs for tracking and feedback
    // No mediaId here as we are not auto-saving to creator_media anymore
    const logDocRef = await addDoc(collection(db, 'ai_generation_logs'), {
        userId,
        prompt,
        enhancedPrompt: enhancedPrompt || prompt,
        mediaUrl: finalUrl,
        paymentReference: ledgerId,
        timestamp: serverTimestamp(),
        satisfactionScore: null // Initialize as null
    });

    return NextResponse.json({ 
        logId: logDocRef.id, // Return logId to client for feedback update
        mediaUrl: finalUrl,
        prompt: prompt,
        enhancedPrompt: enhancedPrompt || prompt
    });

  } catch (error: any) {
    console.error('AI GENERATION ERROR:', error);

    // 4. Refund if something failed after payment
    if (ledgerId && userIdForRefund) {
        console.log("Refunding payment for failed generation:", ledgerId);
        await refundAiGenerationPayment(userIdForRefund, ledgerId, cost);
    }
    
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthenticated')) {
        return NextResponse.json({ 
            error: 'Authentication failed with Replicate. Please check API token.' 
        }, { status: 401 });
    }

    return NextResponse.json({ error: error.message || 'AI generation failed.' }, { status: 500 });
  }
}

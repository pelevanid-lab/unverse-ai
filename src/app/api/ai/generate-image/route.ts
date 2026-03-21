
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
        // Standard mode: Use Flux Dev directly for img2img tasks (more stable slug)
        model = "black-forest-labs/flux-dev";
        input = {
            prompt: finalPromptForAI,
            image: image,
            prompt_strength: 0.8,
            num_outputs: 1,
            num_inference_steps: 28,
            guidance_scale: 3.5
        };
    }

    // Digital Twin specialized model (Identity Preservation) - NOW POWERED BY FAL.AI
    if (cost === 20 && image) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
          throw new Error("FAL_API_KEY is missing on server.");
      }

      const response = await fetch("https://fal.run/fal-ai/flux-pulid", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: finalPromptForAI,
            reference_image_url: image,
            id_weight: 1.0,
            num_inference_steps: 20,
            guidance_scale: 3.5,
            image_size: "square_hd"
        })
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(`Fal.ai Error: ${errData.detail || response.statusText}`);
      }

      const result = await response.json();
      const falImageUrl = result.images?.[0]?.url;
      
      if (!falImageUrl) {
          throw new Error("Fal.ai returned no image URL.");
      }

      // Re-assign to imageUrl for the following storage logic
      const imageUrl = falImageUrl;
      
      // 3. Storage & DB persistence (same as before)
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from Fal.ai: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const fileName = `ai_twin_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const imagePath = `creator-media/${userId}/${fileName}`;
      const storageRef = ref(storage, imagePath);
      await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/png' });
      const finalUrl = await getDownloadURL(storageRef);

      const logDocRef = await addDoc(collection(db, 'ai_generation_logs'), {
          userId,
          prompt,
          enhancedPrompt: enhancedPrompt || prompt,
          mediaUrl: finalUrl,
          paymentReference: ledgerId,
          timestamp: serverTimestamp(),
          satisfactionScore: null
      });

      return NextResponse.json({ 
          logId: logDocRef.id, 
          mediaUrl: finalUrl,
          prompt: prompt,
          enhancedPrompt: enhancedPrompt || prompt
      });
    }
 else if ((cost === 8 || cost === 4) && image) {
      // AI Edit / In-painting specialized model
      model = "black-forest-labs/flux-fill-dev";
      input = {
        prompt: finalPromptForAI,
        image: image,
        mask: mask || image, 
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

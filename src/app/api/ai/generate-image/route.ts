
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
    let finalPromptForAI = enhancedPrompt || prompt;
    
    // Dynamic Negative Prompt based on requested profile & scene
    let negativeFils = "child, kid, toddler, teenager, underage, portrait, close-up, cropped, headshot, macro, room, indoors, studio, apartment, office, domestic, ceiling, wall";
    
    if (finalPromptForAI.toLowerCase().includes("woman") || finalPromptForAI.toLowerCase().includes("female")) {
        negativeFils += ", man, male, facial hair, beard";
    } else if (finalPromptForAI.toLowerCase().includes("man") || finalPromptForAI.toLowerCase().includes("male")) {
        negativeFils += ", woman, female";
    }

    const userNegativePrompt = negativePrompt ? `${negativePrompt}, ${negativeFils}` : negativeFils;
    
    // Solo Subject & Full Body Enforcement
    if (!finalPromptForAI.toLowerCase().includes("duo") && !finalPromptForAI.toLowerCase().includes("group")) {
        finalPromptForAI = `FULL BODY SHOT, WIDE ANGLE VIEW, 1 adult person, ${finalPromptForAI}`;
    }

    let model: any = "black-forest-labs/flux-dev";
    let input: any = {
      prompt: finalPromptForAI,
      aspect_ratio: "1:1",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      negative_prompt: userNegativePrompt,
    };
    
    // Final Audit Copy for for Logging
    const finalAuditPrompt = finalPromptForAI;

    if (image && cost === 5) {
        // Standard mode with reference: maintain same model but keep img2img logic
        input = {
            ...input,
            image: image,
            prompt_strength: 0.8,
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
            prompt: `A high-quality professional portrait of the subject person from the reference image. The person is ${finalPromptForAI}. Photorealistic, cinematic lighting, 8k.`,
            reference_image_url: image,
            id_weight: 1.25, // Increased for stronger likeness
            num_inference_steps: 30, // Higher steps for quality
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
    // AI Edit / In-painting specialized model - NOW POWERED BY FAL.AI
    } else if ((cost === 8 || cost === 4) && image) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
          throw new Error("FAL_API_KEY is missing on server.");
      }

      // We use Fal's dedicated in-painting model for superior background control
      const response = await fetch("https://fal.run/fal-ai/flux-general/inpainting", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: `Maintain the absolute likeness and details of the person in the image. ${finalPromptForAI}`,
            image_url: image, // Base64
            mask_url: undefined, // Let Fal auto-detect or treat as a global edit if no mask
            num_inference_steps: 28,
            guidance_scale: 30,
            strength: 0.95
        })
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(`Fal.ai Edit Error: ${errData.detail || response.statusText}`);
      }

      const result = await response.json();
      const falImageUrl = result.images?.[0]?.url;
      
      if (!falImageUrl) {
          throw new Error("Fal.ai Edit returned no image URL.");
      }

      const imageUrl = falImageUrl;
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const fileName = `ai_edit_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
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
        finalAuditPrompt: finalAuditPrompt, // Forensic log
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

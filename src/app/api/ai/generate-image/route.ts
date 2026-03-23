
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
    const { prompt, enhancedPrompt, translation, negativePrompt, userId, image, mask, character, outfit, imageUrls, isMasterPreview, seed } = json;
    cost = json.cost || 5; 

    // 1. IDENTITY ANCHORS (Digital Twin 3.0)
    const STRONG_IDENTITY_POSITIVE = "maintain 100% exact facial copy of the reference image, absolute likeness, identical person, exact same face";
    const STRONG_IDENTITY_NEGATIVE = "different person, altered facial structure, blurry face, distorted features";

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

    // 2. FAIL-SAFE PROMPT MERGING
    const userOutfit = outfit || '';
    const userSceneEnglish = translation || prompt; 
    
    // IDENTITY LOCK: Ensure character traits are hard-coded in the foundation
    const gender = character?.gender || 'person';
    const hair = character?.hairColor || '';
    const eyes = character?.eyeColor || '';
    const body = character?.bodyType || character?.bodyStyle || 'natural';
    const height = character?.height || 'average';
    const vibe = character?.vibe || 'natural';
    
    const subjectAnchor = `SUBJECT: A solo ${gender}${hair ? `, with ${hair} hair` : ''}${eyes ? `, ${eyes} eyes` : ''}, ${body} body type, and ${height} height. Vibe: ${vibe}.`;

    // Construct the "Security Anchor" (Strict English ONLY)
    const securityAnchor = `1 adult person, FULL BODY SHOT, WIDE ANGLE VIEW. OUTFIT: ${userOutfit || 'as requested'}. ${subjectAnchor} SCENE: ${userSceneEnglish}.`;
    
    let basePrompt = enhancedPrompt || translation || prompt;
    
    // If Gemini returned a uselessly short prompt, discard it and use a high-quality fallback
    if (enhancedPrompt && enhancedPrompt.length < 25) {
        console.warn("Gemini Truncation Detected. Using Fallback.");
        basePrompt = `a high quality detailed photorealistic image of the subject in this scenario: ${userSceneEnglish}`;
    }

    const isIdentityLocked = (cost === 3 || cost === 20 || cost === 10 || (cost === 5 && character) || (cost === 0 && character));
    const identityPrefix = isIdentityLocked ? `${STRONG_IDENTITY_POSITIVE}. ` : '';
    let finalPromptForAI = `${identityPrefix}${securityAnchor} ${basePrompt}`;
    
    // Dynamic Negative Prompt based on requested profile & scene
    let negativeFils = "child, kid, toddler, teenager, underage, portrait, close-up, cropped, headshot, macro, room, indoors, studio, apartment, office, domestic, ceiling, wall";
    
    if (finalPromptForAI.toLowerCase().includes("woman") || finalPromptForAI.toLowerCase().includes("female")) {
        negativeFils += ", man, male, facial hair, beard";
    } else if (finalPromptForAI.toLowerCase().includes("man") || finalPromptForAI.toLowerCase().includes("male")) {
        negativeFils += ", woman, female";
    }

    const identityNegativeAnchor = isIdentityLocked ? `${STRONG_IDENTITY_NEGATIVE}, ` : '';
    const userNegativePrompt = negativePrompt ? `${identityNegativeAnchor}${negativePrompt}, ${negativeFils}` : `${identityNegativeAnchor}${negativeFils}`;
    
    // Solo Subject Enforcement
    if (!finalPromptForAI.toLowerCase().includes("duo") && !finalPromptForAI.toLowerCase().includes("group")) {
        finalPromptForAI = `1 adult person, ${finalPromptForAI}`;
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

    // 4. LINGUISTIC FIREWALL & VALIDATION (User Instruction 4)
    const containsTurkish = (text: string) => {
        const trChars = /[ğüşıöçĞÜŞİÖÇ]/;
        return trChars.test(text);
    };

    if (containsTurkish(finalPromptForAI)) {
        console.error("Linguistic Firewall Triggered: Turkish remnants detected.", finalPromptForAI);
        throw new Error("Linguistic Firewall: Non-English characters detected in final prompt. Please try again.");
    }

    // SHARED LOGGING HELPER
    const createAuditLog = async (imageUrl: string) => {
        const logData = {
          userId,
          prompt: prompt, // Original User Input
          translatedPrompt: translation || prompt, 
          enhancedPrompt: enhancedPrompt || "",
          finalAuditPrompt: finalPromptForAI,
          mediaUrl: imageUrl,
          paymentReference: ledgerId,
          timestamp: serverTimestamp(),
          satisfactionScore: null,
          tags: ["standard", "english-pivot"]
        };
        return await addDoc(collection(db, 'ai_generation_logs'), logData);
    };

    // Digital Twin specialized model (Identity Preservation) - NOW POWERED BY FAL.AI
    const imageToUseForTwin = image || character?.referenceImageUrl;
    if (isIdentityLocked && imageToUseForTwin) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
          throw new Error("FAL_API_KEY is missing on server.");
      }

      // Use character's saved seed if if available for for consistency, else use passed seed or or or random
      const finalSeed = seed || character?.identitySeed || Math.floor(Math.random() * 1000000000);

      const response = await fetch("https://fal.run/fal-ai/flux-pulid", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: finalPromptForAI,
            reference_image_url: imageToUseForTwin, // Use primary image as as as main reference
            num_inference_steps: 40,
            guidance_scale: 8.5,
            id_weight: 1.0,
            seed: finalSeed,
            negative_prompt: userNegativePrompt
        })
      });

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(`Fal.ai Error: ${errData.detail || response.statusText}`);
      }

      const result = await response.json();
      const imageUrl = result.images?.[0]?.url;

      if (!imageUrl) {
          throw new Error("Fal.ai returned no image URL.");
      }

      // 3. Storage & DB persistence
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const fileName = `ai_twin_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const imagePath = `creator-media/${userId}/${fileName}`;
      const storageRef = ref(storage, imagePath);
      await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/png' });
      const finalUrl = await getDownloadURL(storageRef);

      const logDocRef = await createAuditLog(finalUrl);

      return NextResponse.json({ 
          logId: logDocRef.id, 
          mediaUrl: finalUrl,
          finalAuditPrompt: finalPromptForAI 
      });
    // AI Edit / In-painting specialized model - NOW POWERED BY FAL.AI
    } else if ((cost === 8 || cost === 4) && image) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) throw new Error("FAL_API_KEY missing.");

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
      const imageUrl = result.images?.[0]?.url;
      
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const fileName = `ai_edit_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const imagePath = `creator-media/${userId}/${fileName}`;
      const storageRef = ref(storage, imagePath);
      await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/png' });
      const finalUrl = await getDownloadURL(storageRef);

      const logDocRef = await createAuditLog(finalUrl);

      return NextResponse.json({ 
          logId: logDocRef.id, 
          mediaUrl: finalUrl,
          finalAuditPrompt: finalPromptForAI
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
    const logDocRef = await createAuditLog(finalUrl);

    return NextResponse.json({ 
      mediaUrl: finalUrl, 
      logId: logDocRef.id,
      finalAuditPrompt: finalPromptForAI 
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

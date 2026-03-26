
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { processAiGenerationPaymentServer, refundAiGenerationPaymentServer } from '@/lib/ledger-server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  let ledgerId: string | null = null;
  let userIdForRefund: string | null = null;
  let cost = 5; // Moved cost definition outside try block

  try {
    const json = await req.json();
    const { prompt, enhancedPrompt, translation, originalEnhancedPrompt, negativePrompt, userId, image, mask, character, outfit, imageUrls, isMasterPreview, seed, isFreeArt, sceneLock, sceneType, isAdvanced } = json;
    cost = json.cost || 5; 

    // 1. IDENTITY ANCHORS (Digital Twin 3.0)
    const STRONG_IDENTITY_POSITIVE = "maintain 100% exact facial copy of the reference image, absolute likeness, identical person, exact same face";
    const STRONG_IDENTITY_NEGATIVE = "different person, altered facial structure, blurry face, distorted features";

    if (!prompt || !userId) {
      return NextResponse.json({ error: 'Prompt and userId are required' }, { status: 400 });
    }

    console.log(`[API] Generation Request - Cost: ${cost}, Image: ${image ? 'Present' : 'Missing'}, Mask: ${mask ? 'Present' : 'Missing'}`);

    userIdForRefund = userId;

    // 1. Process Payment (Deduct amount)
    try {
        ledgerId = await processAiGenerationPaymentServer(userId, cost);
    } catch (payErr: any) {
        if (payErr.message === 'INSUFFICIENT_ULC') {
            return NextResponse.json({ error: `Not enough ULC. This action costs ${cost} ULC.` }, { status: 402 });
        }
        throw payErr;
    }

    // 2. FAIL-SAFE PROMPT MERGING
    const userOutfit = outfit || '';
    const userSceneEnglish = translation || prompt; 
    
    let finalPromptForAI = "";
    let userNegativePrompt = "";
    let isIdentityLocked = false;
    let id_weight = 1.0;
    let shotType = "portrait"; // default

    // Detect Shot Type for Adaptive Identity Weight
    const lowerPrompt = (enhancedPrompt || translation || prompt || "").toLowerCase();
    if (lowerPrompt.includes("wide") || lowerPrompt.includes("full body") || lowerPrompt.includes("environment") || lowerPrompt.includes("landscape") || lowerPrompt.includes("distant") || lowerPrompt.includes("far away")) {
        shotType = "wide";
        id_weight = 0.65; // 🚀 Maximum environmental and pose freedom
    } else if (lowerPrompt.includes("mid shot") || lowerPrompt.includes("medium shot") || lowerPrompt.includes("waist up") || lowerPrompt.includes("knees up")) {
        shotType = "mid";
        id_weight = 0.8; // 🎬 More flexible for mid-body poses
    } else {
        shotType = "portrait";
        id_weight = 0.9; // 🧬 High likeness but allows head/hair movement
    }

    if (isFreeArt) {
        // FREE ART MODE: No identity or subject anchors
        if (originalEnhancedPrompt && (cost === 5 || cost === 3)) {
            console.log("FREE ART SCENE LOCK: Applying variation logic.");
            // translation contains the Gemini-generated adaptation directive + outfit anchor
            finalPromptForAI = `${translation || 'cinematic masterpiece'}, ${originalEnhancedPrompt}`;
        } else {
            finalPromptForAI = enhancedPrompt || translation || prompt;
        }
        userNegativePrompt = negativePrompt || "blurry, low quality, distorted, deformed, watermark, low resolution";
        isIdentityLocked = false;
    } else {
        // CHARACTER MODE (Standard/Digital Twin)
        isIdentityLocked = (cost === 3 || cost === 20 || cost === 10 || (cost === 5 && character) || (cost === 0 && character));
        
        const gender = character?.gender || 'person';
        const hair = character?.hairColor || '';
        const eyes = character?.eyeColor || '';
        const body = character?.bodyType || character?.bodyStyle || 'natural';
        const height = character?.height || 'average';
        const vibe = character?.vibe || 'natural';
        
        // 🧬 TRIPLE-ANCHOR STRATEGY 3.1: LAYERED FACE LOCKING
        // Anchor 1: USER SCENARIO (The core command)
        const scenarioAnchor = `CORE SCENARIO: ${userSceneEnglish}.`;
        
        // Anchor 2: IDENTITY (Layered: Reference + Physical Anchor + Expression)
        const physicalAnchor = `${gender}${hair ? `, with ${hair} hair` : ''}${eyes ? `, ${eyes} eyes` : ''}, ${body} body type`;
        
        // Expression detection (Did the user or director mode request a smile/mood?)
        const lowerCasePrompt = (translation || prompt || "").toLowerCase();
        const hasHighMovementExpression = lowerCasePrompt.includes("smile") || 
                                          lowerCasePrompt.includes("laugh") || 
                                          lowerCasePrompt.includes("happy") || 
                                          lowerCasePrompt.includes("angry") || 
                                          lowerCasePrompt.includes("seductive") ||
                                          lowerCasePrompt.includes("cheerful") ||
                                          lowerCasePrompt.includes("playful");

        // ADAPTIVE ID WEIGHT: Refine the base id_weight (from shot type) if expression is present
        // 🧬 GOLDILOCKS ZONE: 0.80 allows movement without losing jawline/face-shape
        if (hasHighMovementExpression) {
            id_weight = Math.min(id_weight, 0.80);
        } else {
            id_weight = Math.max(id_weight, 0.85); 
        }

        const identityLine = isIdentityLocked && (character?.referenceImageUrl || image)
            ? `identical person as reference image, 100% facial likeness, same individual, ${physicalAnchor}. EXPRESSION: requested mood/emotion.`
            : `SUBJECT: A solo ${physicalAnchor}, and ${height} height. Vibe: ${vibe}.`;
            
        // Anchor 3: DETAILS (Gemini expanded atmospheric richness)
        let detailsAnchor = enhancedPrompt || "";
        if (detailsAnchor.length < 25) {
            detailsAnchor = `cinematic high-quality photorealistic rendering, highly detailed textures, 8k resolution, professional lighting.`;
        }

        // Final Assembly for for Standard Generations
        finalPromptForAI = `${scenarioAnchor} IDENTITY: ${identityLine}. ATMOSPHERE: ${detailsAnchor}`;

        // 🚀 SCENE CONSISTENCY LOCK: If this is a variation, we use the DNA and Original Prompt
        if (originalEnhancedPrompt && (cost === 5 || cost === 3)) {
            console.log(`SCENE CONSISTENCY LOCK: Applying variation logic (Same Photoshoot Mode). Scene: ${sceneType || 'generic'}`);
            
            // variation directive (shot type, angle, etc.)
            const framingDirective = translation || 'cinematic framing';
            
            // 🧬 DNA REINFORCEMENT: Enforce initial scene elements verbatim
            const outfitAnchor = sceneLock?.outfitSummary ? `OUTFIT: ${sceneLock.outfitSummary}` : "identical clothing";
            const envAnchor = sceneLock?.environmentSummary ? `LOCATION: ${sceneLock.environmentSummary}` : "identical surroundings";
            const lightAnchor = sceneLock?.lightingSummary ? `LIGHTING: ${sceneLock.lightingSummary}` : "same lighting";
            
            // 🎬 SAME PHOTOSHOOT REINFORCEMENT: 
            const persistentContext = `Same photoshoot, ${outfitAnchor}, ${envAnchor}, ${lightAnchor}`;
            const baseSceneContext = `Original location and setup: ${originalEnhancedPrompt}`;
            
            finalPromptForAI = `${framingDirective}. ${persistentContext}. ${baseSceneContext}. IDENTITY: ${identityLine}. STRICT RULE: do not change environment, outfit, lighting setup or character identity.`;
        }
        
        // 🕊️ AI EDIT / IN-PAINTING PROMPT ASSEMBLY (Outside character block if needed)
        if (!finalPromptForAI && (cost === 8 || cost === 4)) {
            finalPromptForAI = translation || prompt || "";
        }
        
        // Dynamic Negative Prompt based on requested profile & scene
        // 🧬 SKELETAL PROTECTION: Added "altered jawline" and "different face shape" to negative prompt
        let negativeFils = "child, kid, toddler, teenager, underage, worst quality, low quality, blurry, distorted, deformed, watermark, bad anatomy, bad hands, altered jawline, different face shape, different person";
        
        if (finalPromptForAI.toLowerCase().includes("woman") || finalPromptForAI.toLowerCase().includes("female")) {
            negativeFils += ", man, male, facial hair, beard";
        } else if (finalPromptForAI.toLowerCase().includes("man") || finalPromptForAI.toLowerCase().includes("male")) {
            negativeFils += ", woman, female";
        }

        // 🛡️ UNIQ PRO: Relax nudity-related filters in negative prompt
        if (isAdvanced) {
            negativeFils = negativeFils.replace(/nsfw|nudity|naked|exposed/gi, "");
        }

        const identityNegativeAnchor = isIdentityLocked ? `${STRONG_IDENTITY_NEGATIVE}, ` : '';
        userNegativePrompt = negativePrompt ? `${identityNegativeAnchor}${negativePrompt}, ${negativeFils}` : `${identityNegativeAnchor}${negativeFils}`;
        
        // Solo Subject Enforcement
        if (!finalPromptForAI.toLowerCase().includes("duo") && !finalPromptForAI.toLowerCase().includes("group")) {
            finalPromptForAI = `1 adult person, ${finalPromptForAI}`;
        }

        // 🛡️ CLEVER BYPASS 2.0: Artistic Protection for Advanced Mode
        if (isAdvanced) {
            const artisticQualifiers = "fine art photography, vogue editorial style, high fashion aesthetic, professional studio lighting, detailed skin texture, raw photo, masterpiece, elegant composition";
            finalPromptForAI = `${artisticQualifiers}, ${finalPromptForAI}`;
            
            // Final Sanitization: Remove any accidentally leaked explicit trigger words
            finalPromptForAI = finalPromptForAI.replace(/nsfw|naked|porn|sex|erotic|explicit|minimal coverage|extreme cut-outs/gi, (match) => {
                const map: Record<string, string> = {
                    'nsfw': 'artistic',
                    'naked': 'unclothed fine art',
                    'porn': 'avant-garde',
                    'sex': 'intimate',
                    'erotic': 'sultry high-fashion',
                    'explicit': 'detailed',
                    'minimal coverage': 'avant-garde silhouette',
                    'extreme cut-outs': 'architectural negative space'
                };
                return map[match.toLowerCase()] || 'artistic';
            });
        }
    }

    // Use character's saved seed if available for consistency, else use passed seed or random
    const finalSeed = seed || character?.identitySeed || Math.floor(Math.random() * 1000000000);

    let model: any = isFreeArt ? "black-forest-labs/flux-schnell" : "black-forest-labs/flux-dev";
    let input: any = {
      prompt: finalPromptForAI,
      aspect_ratio: "1:1",
      num_inference_steps: isFreeArt ? 4 : 28, // Schnell needs fewer steps
      guidance_scale: isFreeArt ? 2.5 : 7.5,
      seed: finalSeed,
      negative_prompt: userNegativePrompt,
    };
    
    // Final Audit Copy for for Logging
    const finalAuditPrompt = finalPromptForAI;

    // 🏋️ POSE-AWARE STRENGTH: Detect if user is requesting a major pose change (e.g. sitting -> standing)
    // If a major pose change is detected, we lower prompt_strength to allow more pixel flexibility 
    // while Pulid maintains the facial identity.
    let finalPromptStrength = 0.8;
    const poseKeywords = ["standing up", "standing", "walking", "running", "jumping", "climbing", "leaping"];
    const isPoseChange = poseKeywords.some(word => lowerPrompt.includes(word));
    
    if (isPoseChange) {
        console.log("[UNIQ] Major pose change detected. Lowering prompt_strength to 0.65 for flexibility.");
        finalPromptStrength = 0.65;
    }

    if (image && (cost === 5 || cost === 10)) {
        // Standard mode with reference: maintain same model but keep img2img logic
        input = {
            ...input,
            image: image,
            prompt_strength: finalPromptStrength,
        };
    }

    // 4. LINGUISTIC FIREWALL & VALIDATION (User Instruction 4)
    const shouldTranslate = (text: string) => {
        const nonAscii = /[^\x00-\x7F]/;
        return nonAscii.test(text);
    };

    const translateToEnglish = async (text: string) => {
        if (!shouldTranslate(text)) return text;
        try {
            const response = await fetch(`${new URL(req.url).origin}/api/ai/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang: 'en' })
            });
            if (!response.ok) return text;
            const data = await response.json();
            return data.translation || text;
        } catch (e) {
            console.warn("Autonomous translation failed:", e);
            return text;
        }
    };
    
    // HELPER: Fetch image as buffer, with internal bucket awareness
    const fetchImageBuffer = async (url: string) => {
        try {
            // Check if it's our own storage URL to avoid permission issues and save bandwidth
            const bucketName = adminStorage.bucket().name;
            if (url.includes(`storage.googleapis.com/${bucketName}/`)) {
                const path = url.split(`${bucketName}/`)[1].split('?')[0]; // Strip query params
                console.log(`[STORAGE_HELPER] Internal read detected: ${path}`);
                const [buffer] = await adminStorage.bucket().file(path).download();
                return buffer;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`External fetch failed: ${response.statusText}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (e: any) {
            console.error(`[STORAGE_HELPER] Buffer fetch failed for ${url}:`, e.message);
            throw e;
        }
    };

    // 🕊️ Apply Linguistic Firewall
    if (shouldTranslate(finalPromptForAI)) {
        console.warn("Linguistic Firewall: Non-ASCII detected. Translating...", finalPromptForAI);
        finalPromptForAI = await translateToEnglish(finalPromptForAI);
        console.log("Linguistic Firewall: Translation complete.", finalPromptForAI);
    }

    // SHARED LOGGING HELPER
    const createAuditLog = async (imageUrl: string) => {
        const logData = {
          userId,
          authUid: json.authUid || null, // 🧬 Identity Bridge: Persist Firebase UID in logs
          prompt: prompt, // Original User Input
          translatedPrompt: translation || prompt, 
          enhancedPrompt: enhancedPrompt || "",
          finalAuditPrompt: finalPromptForAI,
          mediaUrl: imageUrl,
          paymentReference: ledgerId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          satisfactionScore: null,
          tags: ["standard", "english-pivot"],
          // 🚀 DEBUG FIELDS
          idMode: isIdentityLocked ? (isFreeArt ? 'free-art-lock' : 'pulid-character') : 'none',
          idWeight: isIdentityLocked ? id_weight : 0,
          shotType: shotType,
          guidanceScale: isIdentityLocked ? 7.0 : (isFreeArt ? 2.5 : 7.5),
          isReferenceActive: !!imageToUseForTwin,
          isAdvanced: !!isAdvanced
        };
        return await adminDb.collection('ai_generation_logs').add(logData);
    };

    // Digital Twin specialized model (Identity Preservation) - NOW POWERED BY UNIQ ENGINE
    const imageToUseForTwin = image || character?.referenceImageUrl;
    if (isIdentityLocked && imageToUseForTwin) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
          throw new Error("FAL_API_KEY is missing on server.");
      }
      console.log(`UNIQ PULID INPUT: prompt="${finalPromptForAI}", image="${imageToUseForTwin}"`);

      // 🚀 Use finalSeed defined above
      console.log(`UNIQ PULID: Shot=${shotType}, Weight=${id_weight}, Seed=${finalSeed}`);

      const falPayload = {
          prompt: finalPromptForAI,
          reference_image_url: imageToUseForTwin, // 🚀 FAL-AI REQUIRED KEY: reference_image_url
          id_weight: id_weight,
          seed: finalSeed,
          negative_prompt: userNegativePrompt,
          num_inference_steps: isAdvanced ? 50 : 28, 
          guidance_scale: isAdvanced ? 7.5 : 3.5,
      };

      console.log("Fal.ai Full Payload:", JSON.stringify(falPayload, null, 2));

      const response = await fetch("https://fal.run/fal-ai/flux-pulid", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(falPayload)
      });

      if (!response.ok) {
          const errData = await response.json();
          const errorMsg = errData.detail ? (typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail)) : JSON.stringify(errData);
          console.error("Fal.ai Engine Error Details:", errorMsg);
          throw new Error(`Uniq Engine Error: ${errorMsg}`);
      }

      const result = await response.json();
      const imageUrl = result.images?.[0]?.url;

      if (!imageUrl) {
          console.error("Uniq Engine Error: No image URL in result", result);
          throw new Error("Uniq Engine returned no image URL. Possible safety block despite bypass.");
      }

      // 3. Storage & DB persistence
      const imageBuffer = await fetchImageBuffer(imageUrl);
      const imageBase64 = imageBuffer.toString('base64');

      const fileName = `ai_twin_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const imagePath = `creator-media/${userId}/${fileName}`;
      const bucket = adminStorage.bucket();
      const file = bucket.file(imagePath);
      await file.save(imageBuffer, {
          metadata: { contentType: 'image/png' }
      });

      // 🔐 Generate SIGNED URL (Fixed AccessDenied in Director Mode)
      const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      const finalUrl = signedUrl;

      const logDocRef = await createAuditLog(finalUrl);

      return NextResponse.json({ 
          logId: logDocRef.id, 
          mediaUrl: finalUrl,
          mediaBase64: `data:image/png;base64,${imageBase64}`, 
          finalAuditPrompt: finalPromptForAI 
      });
    // AI Edit / In-painting specialized model - NOW POWERED BY UNIQ ENGINE
    } else if ((cost === 8 || cost === 4) && image) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) throw new Error("FAL_API_KEY missing.");

      // 🧬 IDENTITY PROTECTION: We force the model to respect the original person by adding a strict directive
      const inpaintPrompt = `(STRICT PIXEL-PERFECT IDENTITY LOCK: Do not change the person's face, features, expression, clothes, body or pose. Keep them 100% identical to the original image:1.8). ${finalPromptForAI}`;
      const inpaintNegative = "different person, altered facial structure, change of clothes, different hairstyle, face change, older, younger, distorted face, changed body type, altered pose, different outfit";

      const response = await fetch("https://fal.run/fal-ai/flux-general/inpainting", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: inpaintPrompt,
            image_url: image, // Base64
            mask_url: mask, 
            negative_prompt: inpaintNegative,
            num_inference_steps: 35, // 🚀 Increased steps for higher fidelity
            guidance_scale: 20, // 🚀 Maximum allowed by Fal for flux-inpainting
            strength: 0.90 // 🚀 Slightly lower strength to keep subject more anchored
        })
      });

      if (!response.ok) {
          const errData = await response.json();
          // 🚀 Robust Error Serialization (Avoid [object Object])
          const errorMsg = typeof errData.detail === 'string' 
            ? errData.detail 
            : JSON.stringify(errData.detail || errData);
          throw new Error(`Uniq Engine Edit Error: ${errorMsg}`);
      }

      const result = await response.json();
      const imageUrl = result.images?.[0]?.url;
      
      const imageBuffer = await fetchImageBuffer(imageUrl);
      const imageBase64 = imageBuffer.toString('base64');

      const fileName = `ai_edit_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const imagePath = `creator-media/${userId}/${fileName}`;
      const bucket = adminStorage.bucket();
      const file = bucket.file(imagePath);
      await file.save(imageBuffer, {
          metadata: { contentType: 'image/png' }
      });

      // 🔐 Generate SIGNED URL (Fixed AccessDenied in Director Mode)
      const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      const finalUrl = signedUrl;

      const logDocRef = await createAuditLog(finalUrl);

      return NextResponse.json({ 
          logId: logDocRef.id, 
          mediaUrl: finalUrl,
          mediaBase64: `data:image/png;base64,${imageBase64}`,
          finalAuditPrompt: finalPromptForAI
      });
    }

    // Standard fallback (Replicate)
    const rawToken = process.env.REPLICATE_API_TOKEN;
    if (!rawToken) {
      throw new Error('Replicate API token is missing on the server.');
    }

    const replicate = new Replicate({
      auth: rawToken.trim(),
    });

    const output = await replicate.run(model, { input }) as string[];

    if (!output || !output[0]) {
        throw new Error("AI returned empty output.");
    }

    const imageUrl = output[0];
    
    // 3. Storage & DB persistence
    const imageBuffer = await fetchImageBuffer(imageUrl);
    const imageBase64 = imageBuffer.toString('base64');

    const fileName = `ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const imagePath = `creator-media/${userId}/${fileName}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(imagePath);
    await file.save(imageBuffer, {
        metadata: { contentType: 'image/png' }
    });
    
    // Generate a signed URL for immediate viewing (expires in 1 week)
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    const finalUrl = signedUrl;

    // Save logic removed from here as per user request (no auto-save to pool)
    // The previous addDoc call to 'creator_media' has been removed.

    // 🚀 NEW: Create entry in ai_generation_logs for tracking and feedback
    // No mediaId here as we are not auto-saving to creator_media anymore
    const logDocRef = await createAuditLog(finalUrl);

    return NextResponse.json({ 
      mediaUrl: finalUrl, 
      mediaBase64: `data:image/png;base64,${imageBase64}`,
      logId: logDocRef.id,
      finalAuditPrompt,
      seed: finalSeed 
    });

  } catch (error: any) {
    console.error('AI GENERATION ERROR:', error);

    // 4. Refund if something failed after payment
    if (ledgerId && userIdForRefund) {
        console.log("Refunding payment for failed generation:", ledgerId);
        await refundAiGenerationPaymentServer(userIdForRefund, ledgerId, cost);
    }
    
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthenticated')) {
        return NextResponse.json({ 
            error: `Uniq Engine Authentication Failed (check API keys). Details: ${error.message}` 
        }, { status: 401 });
    }

    return NextResponse.json({ error: error.message || 'AI generation failed.' }, { status: 500 });
  }
}

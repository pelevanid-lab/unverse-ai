
export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { processAiGenerationPaymentServer, refundAiGenerationPaymentServer } from '@/lib/ledger-server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { SceneStateManager } from '@/lib/ai-engine/SceneStateManager';
import { GenerationContextLoader } from '@/lib/ai-engine/GenerationContextLoader';
import { SceneBrainEngine } from '@/lib/ai-engine/SceneBrainEngine';
import { PromptComposer } from '@/lib/ai-engine/PromptComposer';
import { CriticEngine } from '@/lib/ai-engine/CriticEngine';
import { RetryEngine } from '@/lib/ai-engine/RetryEngine';
import { VariationEngine } from '@/lib/ai-engine/VariationEngine';
import { 
    SceneState, 
    ScenePlan, 
    SceneLock, 
    CharacterProfile, 
    CriticResult, 
    IdentityCore, 
    HybridRoute 
} from '@/lib/types';

export async function POST(req: Request) {
  let ledgerId: string | null = null;
  let userIdForRefund: string | null = null;
  let cost = 5; 

  try {
    const json = await req.json();
    const {
        prompt,
        enhancedPrompt,
        translation,
        originalEnhancedPrompt,
        negativePrompt,
        userId,
        image,
        mask,
        character,
        outfit,
        imageUrls,
        isMasterPreview,
        seed,
        isFreeArt,
        sceneLock,
        sceneType,
        isAdvanced,
        // 🧬 NEW STATEFUL PARAMS
        sceneStateId,
        isStateful = false,
        directorSelections,
        mode // 🎯 EXPLICIT MODE (Phase 24)
    } = json;
    
    // FEATURE FLAG (Can be moved to env or DB)
    const IS_STATEFUL_ENABLED = true; 
    const isUsingStateful = IS_STATEFUL_ENABLED && (isStateful || sceneStateId);

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

    // HELPER: Fetch image as buffer, with internal bucket awareness
    const fetchImageBuffer = async (url: string) => {
        try {
            const bucketName = adminStorage.bucket().name;
            if (url.includes(`storage.googleapis.com/${bucketName}/`)) {
                const path = url.split(`${bucketName}/`)[1].split('?')[0]; 
                const [buffer] = await adminStorage.bucket().file(path).download();
                return buffer;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`External fetch failed: ${response.statusText}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (e: any) {
            console.error(`[STORAGE_HELPER] Buffer fetch failed:`, e.message);
            throw e;
        }
    };

    // SHARED LOGGING HELPER
    const createAuditLog = async (imageUrl: string) => {
        const logData = {
          userId,
          authUid: json.authUid || null,
          prompt: prompt,
          translatedPrompt: translation || prompt, 
          enhancedPrompt: enhancedPrompt || "",
          finalAuditPrompt: finalPromptForAI,
          mediaUrl: imageUrl,
          paymentReference: ledgerId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          satisfactionScore: null,
          tags: ["standard", "english-pivot"],
          idMode: isIdentityLocked ? 'system' : 'none',
          idWeight: id_weight,
          shotType: shotType,
          guidanceScale: 7.5,
          isReferenceActive: true,
          isAdvanced: !!isAdvanced
        };
        return await adminDb.collection('ai_generation_logs').add(logData);
    };

    // 🧬 STATEFUL AI ENGINE (UNIQ 4.0)
    if (isUsingStateful) {
        try {
            console.log(`[STATEFUL] Starting state-based generation for scene: ${sceneStateId || 'new'}`);
            
            // 1. Context Rehydration / Creation
            let state: any;
            if (sceneStateId) {
                const loaded = await GenerationContextLoader.loadContext(sceneStateId, 'state');
                if (loaded) {
                    state = loaded;
                } else {
                    const fromLog = await GenerationContextLoader.loadContext(sceneStateId, 'log');
                    if (fromLog) {
                        const newId = await SceneStateManager.createSceneState({
                            ...fromLog,
                            character_id: character?.id || 'anonymous',
                            sourceType: 'state',
                            locked_elements: { identity: true, outfit: true, environment: true, pose: false },
                            variation_history: [],
                            lastSuccessfulConfig: {}
                        } as any);
                        state = await SceneStateManager.getSceneState(newId);
                    }
                }
            }

            if (!state) {
                // Initial generation - create new state
                const plan = await SceneBrainEngine.generateScenePlan(enhancedPrompt || prompt);
                const newStateId = await SceneStateManager.createSceneState({
                    character_id: character?.id || 'anonymous',
                    sourceType: 'prompt',
                    originalPrompt: prompt,
                    enhancedPrompt: enhancedPrompt || prompt,
                    scene_plan: plan,
                    locked_elements: { identity: true, outfit: true, environment: true, pose: false },
                    variation_history: [],
                    lastSuccessfulConfig: { seed: seed || Math.floor(Math.random() * 1000000000) }
                });
                state = await SceneStateManager.getSceneState(newStateId);
            }

            // 🧬 IDENTITY CORE & HYBRID ROUTING (Identity Protocol 5.0)
            const identityCore: IdentityCore = {
                referenceImageUrl: image || character?.referenceImageUrl || state.referenceImageUrl || "",
                characterProfile: character,
                thresholds: { accept: 0.88, retry: 0.80, reject: 0.00 } // Reject handled by loop termination
            };
            // Declare variables for the retry loop
            let currentRetry = 0;
            let currentImageUrl = "";
            let lastEvaluatedImageUrl = ""; // 🛡️ GOLDEN RULE: For deterministic alignment
            let currentImageBase64 = "";
            let latestCriticResult: any = null;
            let currentAdjustments: any = null;
            let initialBasePrompt = ""; 
            let finalGeneratedPrompt = ""; 
            const attempts: any[] = []; // 🧬 STRUCTURED ATTEMPT HISTORY

            // 🧬 PHASE 24: EXPLICIT MODE & EFFICIENCY
            const MAX_RETRY = 2; // Fixed at 2 as per Phase 24 strategy

            // 1. Initial Route Selection (Phase 24: Explicit User Mode)
            let selectedRoute: HybridRoute = 'A';
            if (mode === 'medium') {
                selectedRoute = 'B';
            } else if (mode === 'wide') {
                selectedRoute = 'C';
            } else {
                selectedRoute = 'A'; // Default to Portrait
            }

            // 2. Scene Orchestration (determine initialBasePrompt)
            if (directorSelections) {
                const variation = await VariationEngine.generateVariation(state.scene_id, directorSelections, character);
                initialBasePrompt = variation.prompt;
                state = variation.newState;
            } else {
                // 🧬 PRE-GENERATION VISIBILITY VALIDATION (Director Mode 4.0)
                const visibility = (state.scene_plan.requiredVisibility || []).join(' ').toLowerCase();
                if (mode === 'medium' && state.scene_plan.framing === 'close-up') {
                    console.log("[Phase 24] Auto-correcting framing for Medium Mode");
                    state.scene_plan.framing = 'medium shot';
                    state.scene_plan.bodyVisibilityLevel = 'upper_torso';
                    state.scene_plan.hardConstraints = [...(state.scene_plan.hardConstraints || []), "HANDS MUST BE VISIBLE", "NO CLOSE-UP"];
                    selectedRoute = 'B'; 
                } else if (mode === 'wide') {
                    console.log("[Phase 24] Forcing Wide Shot constraints");
                    state.scene_plan.framing = 'wide cinematic shot';
                    state.scene_plan.bodyVisibilityLevel = 'full_body';
                    state.scene_plan.hardConstraints = [...(state.scene_plan.hardConstraints || []), "SHOW FULL ENVIRONMENT", "UPPER BODY VISIBLE"];
                    selectedRoute = 'C';
                }
                
                initialBasePrompt = PromptComposer.compose(state.scene_plan, character, null, selectedRoute);
            }

            // 3. Generation Loop (Dual-Pass + Critic + Retry)
            while (currentRetry < MAX_RETRY) { // 🧬 MAX 4 ATTEMPTS (1 Initial + 3 Retries) - UNIQ 5.0
                console.log(`[STATEFUL] Gen Attempt ${currentRetry + 1}/${MAX_RETRY} | Route: ${selectedRoute} | Mode: 7.0 (STABILIZED)`);
                
                // Orchestrate Prompt with Adjustments (REBUILD FROM SCRATCH, NO APPEND)
                finalGeneratedPrompt = PromptComposer.compose(state.scene_plan, character, currentAdjustments, selectedRoute);
                const dynamicNegative = PromptComposer.composeNegative(state.scene_plan, negativePrompt || "");

                // 🛡️ PROMPT SANITY CHECK (Identity Protocol 19.0)
                if (finalGeneratedPrompt.includes('{') || finalGeneratedPrompt.includes('}') || finalGeneratedPrompt.includes('```')) {
                    console.error("[INTEGRITY FAIL] Prompt contains JSON/Markdown leak:", finalGeneratedPrompt);
                    throw new Error("[INTEGRITY FAIL] Structured data leaked into generation prompt. Aborting to prevent model corruption.");
                }

                // 🧬 ROUTE-SPECIFIC ID WEIGHTS (Phase 24 - Identity Stability)
                // We keep a high baseline for all routes to ensure identity doesn't drift.
                const baseIdWeight = 0.95; 
                const id_weight = Math.min(1.5, baseIdWeight + (currentAdjustments?.id_weight_boost || 0));
                const guidance_scale = 3.5 + (currentAdjustments?.guidance_scale_boost || 0);

                const falKey = process.env.FAL_API_KEY;
                
                // 🧬 ROUTE DEBUG AUDIT (Phase 23)
                console.log(`[DEBUG] Route Audit | Route: ${selectedRoute} | ID Weight: ${id_weight} | Composition Priority: ${selectedRoute !== 'A'}`);
                console.log(`[DEBUG] Final Prompt (Audit): ${finalGeneratedPrompt}`);

                // 🧬 ROUTE-BASED MODEL MAPPING
                let generatedImageUrl = "";
                
                if (mode === 'medium' || mode === 'wide') {
                    // 🎬 TWO-STEP PIPELINE: 1. Base Generation (Flux Dev/Pro) 2. Face Swap
                    console.log(`[STATEFUL] Using Two-Step Face Swap Pipeline for Mode: ${mode}`);
                    
                    // Strip the overly aggressive text from prompt to let Flux generate a natural face freely before swapping
                    let basePrompt = finalGeneratedPrompt.replace(/IDENTICAL FACE TO REFERENCE|100% facial likeness/gi, "natural detailed face");
                    
                    const baseEndpoint = isAdvanced ? "https://fal.run/fal-ai/flux-pro/v1.1" : "https://fal.run/fal-ai/flux/dev";
                    const actualSeed = state.lastSuccessfulConfig?.seed || seed || Math.floor(Math.random() * 1000000000);
                    
                    const basePayload = {
                        prompt: basePrompt,
                        seed: actualSeed,
                        guidance_scale: isAdvanced ? undefined : guidance_scale,
                        num_inference_steps: isAdvanced ? undefined : ((selectedRoute === 'B' || selectedRoute === 'C') ? 40 : 28)
                    };

                    const baseResponse = await fetch(baseEndpoint, {
                        method: "POST",
                        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify(basePayload)
                    });

                    if (!baseResponse.ok) {
                        const err = await baseResponse.json();
                        console.error("[BASE GEN ERROR]", err);
                        throw new Error(`Base Generation Failed: ${err.detail || 'Unknown error'}`);
                    }
                    const baseResult = await baseResponse.json();
                    let baseImageUrl = baseResult.images[0].url;

                    // 🎭 STEP 2: Face Swap
                    console.log(`[STATEFUL] Base created (${baseImageUrl}). Swapping face using reference...`);
                    const swapResponse = await fetch("https://fal.run/easel-ai/advanced-face-swap", {
                        method: "POST",
                        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            target_image: baseImageUrl,
                            face_image_0: identityCore.referenceImageUrl,
                            gender_0: character?.gender || "female"
                        })
                    });

                    if (!swapResponse.ok) {
                        const err = await swapResponse.json();
                        console.error("[FACE SWAP ERROR]", err);
                        throw new Error(`Face Swap Step Failed: ${err.detail || 'Unknown error'}`);
                    }
                    const swapResult = await swapResponse.json();
                    generatedImageUrl = swapResult.image.url;
                } else {
                    // 🖼️ PORTRAIT PIPELINE (Standard Pulid)
                    console.log(`[STATEFUL] Using Pulid Pipeline for Portrait Mode`);
                    const endpoint = "https://fal.run/fal-ai/flux-pulid";
                    const payload: any = {
                        prompt: finalGeneratedPrompt,
                        reference_image_url: identityCore.referenceImageUrl,
                        id_weight: id_weight,
                        seed: state.lastSuccessfulConfig?.seed || seed || Math.floor(Math.random() * 1000000000),
                        num_inference_steps: (selectedRoute === 'B' || selectedRoute === 'C') ? 40 : 28,
                        guidance_scale: guidance_scale,
                        negative_prompt: dynamicNegative
                    };

                    const response = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        console.error("[PULID GEN ERROR]", err);
                        throw new Error(`Generation Attempt Failed: ${err.detail || 'Unknown error'}`);
                    }
                    const genResult = await response.json();
                    generatedImageUrl = genResult.images[0].url;
                }

                // 👨‍🏫 OPTIMIZED CRITIC ENGINE
                const criticMode = (currentRetry === 0 && MAX_RETRY > 1) ? 'minimal' : 'full';
                latestCriticResult = await CriticEngine.evaluate(generatedImageUrl, state.scene_plan, character, prompt, criticMode);
                lastEvaluatedImageUrl = generatedImageUrl; // 🛡️ LOCK IT
                currentImageUrl = generatedImageUrl; // 🛡️ UPDATE STATE IMMEDIATELY
                
                let issues = latestCriticResult?.issues ?? [];
                console.log(`[CRITIC] Attempt ${currentRetry + 1} (${criticMode}) | Score: ${latestCriticResult.overallScore} | Hands: ${latestCriticResult.handsVisible} | Framing: ${latestCriticResult.framingType}`);

                // 🛡️ CRITICAL GUARD: Ensure we have a valid result before proceeding
                if (!latestCriticResult) {
                    console.error("[CRITIC] Fatal: Critic returned null result. Terminating loop.");
                    break;
                }

                // Push to formal attempt tracking
                attempts.push({
                    attemptId: currentRetry + 1,
                    imageUrl: generatedImageUrl,
                    selectedRoute,
                    mode: criticMode,
                    criticResult: latestCriticResult,
                    scenePlan: JSON.parse(JSON.stringify(state.scene_plan))
                });

                // 🚀 HARD ACCEPTANCE GATES (Phase 24: Mode Enforcement)
                if (mode === 'medium') {
                    const gate_hands = latestCriticResult.handsVisible;
                    const gate_framing = latestCriticResult.framingType !== 'close-up';
                    
                    if (!gate_hands || !gate_framing) {
                        console.warn(`[HARD GATE] Medium Mode Failure. Hands: ${gate_hands}, Framing: ${latestCriticResult.framingType}`);
                        if (currentRetry < MAX_RETRY - 1) {
                            latestCriticResult.retryRecommended = true; 
                        }
                    }
                } else if (mode === 'wide') {
                    const gate_body = latestCriticResult.upperBodyVisible;
                    const gate_framing = latestCriticResult.framingType === 'wide' || latestCriticResult.framingType === 'medium'; // Wide or at least Medium
                    
                    if (!gate_body || !gate_framing) {
                        console.warn(`[HARD GATE] Wide Mode Failure. Body: ${gate_body}, Framing: ${latestCriticResult.framingType}`);
                        if (currentRetry < MAX_RETRY - 1) {
                            latestCriticResult.retryRecommended = true;
                        }
                    }
                } else {
                    // Portrait Mode: Standard Identity Lock is enough
                }

                // 🚀 IDENTITY LOCK (HARD RULE): If score is too low, it's a failure regardless of composition
                if ((latestCriticResult.identityScore || 0) < identityCore.thresholds.retry && currentRetry < MAX_RETRY - 1) {
                    console.warn(`[ID LOCK] Identity drift detected. Forcing retry.`);
                    currentAdjustments = { ...currentAdjustments, id_weight_boost: (currentAdjustments?.id_weight_boost || 0) + 0.1 };
                    // Continue to retry logic
                }

                // 🧬 STRUCTURAL RETRY ENGINE (Phase 24: Mode-Aware Retry)
                const retryDecision = RetryEngine.shouldRetry(currentRetry, latestCriticResult, state.scene_plan);
                
                if (!retryDecision.retry) {
                    break;
                }

                // 🧱 SAFE LOGGING & TRACEABILITY
                issues = latestCriticResult?.issues ?? [];
                console.warn(`[RETRY] Triggering attempt ${currentRetry + 2} due to: ${issues.length ? issues.join(', ') : 'Minor drifts'}`);
                
                if (retryDecision.adjustedPlan) state.scene_plan = retryDecision.adjustedPlan;
                if (retryDecision.adjustedParams) currentAdjustments = { ...currentAdjustments, ...retryDecision.adjustedParams };
                currentRetry++;
            }
   

            // 🛡️ THE GOLDEN RULE: Deterministic Alignment Validation
            if (currentImageUrl !== lastEvaluatedImageUrl) {
                console.error(`[STATE ERROR] Mismatch Detected. Current: ${currentImageUrl} | Last Evaluated: ${lastEvaluatedImageUrl}`);
                throw new Error('[STATE ERROR] Final image mismatch with critic evaluation');
            }

            // storage and logging logic...
            const imageBuffer = await fetchImageBuffer(currentImageUrl);
            currentImageBase64 = imageBuffer.toString('base64');
            const fileName = `stateful_${Date.now()}.png`;
            const imagePath = `creator-media/${userId}/${fileName}`;
            const file = adminStorage.bucket().file(imagePath);
            await file.save(imageBuffer, { metadata: { contentType: 'image/png' } });
            const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });

            // 🧬 LOGGING (Enhanced with Identity Protocol 18.0 Traceability)
            await adminDb.collection('generation_logs').add({
                userId,
                inputPrompt: prompt,
                enhancedPrompt: enhancedPrompt || prompt,
                scenePlan: state.scene_plan,
                selectedRoute, // 🧬 UNIQ 5.0
                modelUsed: selectedRoute === 'A' ? "fal-ai/flux-pulid" : "fal-ai/flux-pro-v2-hybrid",
                params: { 
                    seed: state.lastSuccessfulConfig?.seed, 
                    locks: state.locked_elements,
                    identityThresholds: identityCore.thresholds,
                    devMode: false
                },
                criticResults: [latestCriticResult],
                overallScore: latestCriticResult?.overallScore ?? null,
                identityScore: latestCriticResult?.identityScore ?? null,
                handsVisible: latestCriticResult?.handsVisible ?? false,
                framingType: latestCriticResult?.framingType ?? null,
                retryCount: currentRetry,
                attempts: attempts, // 🧬 REPLACED retryHistory with formal attempts
                outputIds: [signedUrl],
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                status: 'success'
            });

            // 🧬 UPDATE STATE HISTORY & PLAN (Preserve Mutations)
            await SceneStateManager.updateSceneState(state.scene_id, {
                variation_history: [...(state.variation_history || []), signedUrl],
                scene_plan: state.scene_plan,
                outfitSummary: state.outfitSummary || state.scene_plan.outfit // Lock the outfit if found
            });

            return NextResponse.json({ 
                logId: state.scene_id, // Using scene_id as anchor
                mediaUrl: signedUrl,
                mediaBase64: `data:image/png;base64,${currentImageBase64}`, 
                finalAuditPrompt: finalGeneratedPrompt,
                sceneState: state,
                attempts: attempts // Pass to UI for debug if needed
            });

        } catch (err: any) {
            console.error("[STATEFUL ERROR]", err);
            // Fallback would continue below if we don't return here
        }
    }

    // 2. FAIL-SAFE PROMPT MERGING (Legacy Flow)
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
            
            // 🎬 IDENTITY HARDENING (Director/Variation Mode)
            // 🧬 UNIQ 4.0: Increased weight to 0.98 for absolute reference fidelity
            id_weight = Math.max(id_weight, 0.98); 

            // variation directive (shot type, angle, etc.)
            const framingDirective = translation || 'cinematic framing';
            
            // 🧬 DNA REINFORCEMENT: Enforce initial scene elements verbatim
            const outfitAnchor = sceneLock?.outfitSummary ? `OUTFIT: ${sceneLock.outfitSummary}` : "identical clothing";
            const envAnchor = sceneLock?.environmentSummary ? `LOCATION: ${sceneLock.environmentSummary}` : "identical surroundings";
            const lightAnchor = sceneLock?.lightingSummary ? `LIGHTING: ${sceneLock.lightingSummary}` : "same lighting";
            const hairAnchor = sceneLock?.hairSummary ? `HAIR: ${sceneLock.hairSummary}` : "identical hair style";
            
            // 🎬 SAME PHOTOSHOOT REINFORCEMENT: 
            const persistentContext = `Same photoshoot, ${outfitAnchor}, ${envAnchor}, ${lightAnchor}, ${hairAnchor}`;
            const baseSceneContext = `Original location and setup: ${originalEnhancedPrompt}`;
            
            // 🚀 PRIORITY REORDERING: Identity must come FIRST in the string for maximum attention
            finalPromptForAI = `IDENTITY: ${identityLine}. ${framingDirective}. ${persistentContext}. ${baseSceneContext}. STRICT RULE: do not change environment, outfit, lighting setup or character identity. IDENTICAL FACE PIXEL-FOR-PIXEL.`;
        }
        
        // 🕊️ AI EDIT / IN-PAINTING PROMPT ASSEMBLY (Outside character block if needed)
        if (!finalPromptForAI && (cost === 8 || cost === 4)) {
            finalPromptForAI = translation || prompt || "";
        }
        
        // Dynamic Negative Prompt based on requested profile & scene
        // 🧬 SKELETAL PROTECTION: Added "vogue model" and "generic face" to prevent drift
        let negativeFils = "child, kid, toddler, teenager, underage, worst quality, low quality, blurry, distorted, deformed, watermark, bad anatomy, bad hands, altered jawline, different face shape, different person, different nose, altered eye shape, facial drift, vogue model, generic beauty, stock photo face, plastic skin";
        
        if (finalPromptForAI.toLowerCase().includes("woman") || finalPromptForAI.toLowerCase().includes("female")) {
            negativeFils += ", man, male, facial hair, beard";
        } else if (finalPromptForAI.toLowerCase().includes("man") || finalPromptForAI.toLowerCase().includes("male")) {
            negativeFils += ", woman, female";
        }

        // 🛡️ SCENE PRESERVATION: If a specific environment is locked (plane, jet, outdoor), block generic indoor rooms
        if (sceneType === 'jet' || sceneType === 'beach' || sceneType === "nature" || sceneType === "yacht") {
            negativeFils += ", indoor, room, bedroom, house, studio, interior, apartment, office, domestic setting";
        }

        // 🛡️ UNIQ PRO: Relax nudity-related filters in negative prompt
        if (isAdvanced) {
            negativeFils = negativeFils.replace(/nsfw|nudity|naked|exposed/gi, "");
        }

        const identityNegativeAnchor = isIdentityLocked ? `STRONG IDENTITY LOCK (DO NOT DRIFT): ${STRONG_IDENTITY_NEGATIVE}, ` : '';
        userNegativePrompt = negativePrompt ? `${identityNegativeAnchor}${negativePrompt}, ${negativeFils}` : `${identityNegativeAnchor}${negativeFils}`;
        
        // Solo Subject Enforcement
        if (!finalPromptForAI.toLowerCase().includes("duo") && !finalPromptForAI.toLowerCase().includes("group")) {
            finalPromptForAI = `1 adult person, ${finalPromptForAI}`;
        }

        // 🛡️ CLEVER BYPASS 2.0: Artistic Protection for Advanced Mode
        if (isAdvanced) {
            const artisticQualifiers = "fine art photography, high fashion aesthetic, professional studio lighting, detailed skin texture, raw photo, masterpiece, elegant composition";
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
      num_inference_steps: isFreeArt ? 4 : (isAdvanced ? 40 : 28), // 🚀 Uniq Pro: 40 steps is optimal
      guidance_scale: isFreeArt ? 2.5 : (isAdvanced ? 6.0 : 3.5), // 🚀 Uniq Pro: 6.0 scale for better identity retention
      seed: finalSeed,
      negative_prompt: userNegativePrompt,
    };
    
    // Final Audit Copy for for Logging
    const finalAuditPrompt = finalPromptForAI;

    // 🏋️ POSE-AWARE STRENGTH: Detect if user is requesting a major pose change (e.g. sitting -> standing)
    // If a major pose change is detected, we lower prompt_strength to allow more pixel flexibility 
    // while Pulid maintains the facial identity.
    // 🧬 UNIQ 4.0: For variations (img2img), we use a lower prompt_strength (0.55) to lock the background piksels.
    let finalPromptStrength = (cost === 5 || cost === 3) ? 0.55 : 0.8;
    const poseKeywords = ["standing up", "standing", "walking", "running", "jumping", "climbing", "leaping"];
    const isPoseChange = poseKeywords.some(word => lowerPrompt.includes(word));
    
    if (isPoseChange && finalPromptStrength > 0.65) {
        console.log("[UNIQ] Major pose change detected. Using prompt_strength 0.65 for flexibility.");
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
    
    // 🕊️ Apply Linguistic Firewall

    // Digital Twin specialized model (Identity Preservation) - NOW POWERED BY UNIQ ENGINE
    const imageToUseForTwin = image || character?.referenceImageUrl;
    if (isIdentityLocked && imageToUseForTwin) {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) {
          throw new Error("FAL_API_KEY is missing on server.");
      }
      let imageUrl = "";
      const isMidOrWide = mode === 'medium' || mode === 'wide' || shotType === 'mid' || shotType === 'wide';

      if (isMidOrWide) {
          // 🎬 TWO-STEP PIPELINE FOR LEGACY: 1. Base Gen 2. Face Swap
          console.log(`[LEGACY] Using Two-Step Face Swap Pipeline for ShotType: ${shotType}, Mode: ${mode}`);
          let basePrompt = finalPromptForAI.replace(/IDENTICAL FACE TO REFERENCE|100% facial likeness/gi, "natural detailed face");
          
          const baseEndpoint = isAdvanced ? "https://fal.run/fal-ai/flux-pro/v1.1" : "https://fal.run/fal-ai/flux/dev";
          const basePayload = {
              prompt: basePrompt,
              seed: finalSeed,
              guidance_scale: isAdvanced ? undefined : 3.5,
              num_inference_steps: isAdvanced ? undefined : 28
          };

          const baseResponse = await fetch(baseEndpoint, {
              method: "POST",
              headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
              body: JSON.stringify(basePayload)
          });
          
          if (!baseResponse.ok) {
              const err = await baseResponse.json();
              console.error("[LEGACY BASE GEN ERROR]", err);
              throw new Error(`Legacy Base Generation Failed: ${err.detail || 'Unknown error'}`);
          }
          const baseResult = await baseResponse.json();
          let baseImageUrl = baseResult.images[0].url;

          console.log(`[LEGACY] Base created. Swapping face using reference...`);
          const swapResponse = await fetch("https://fal.run/easel-ai/advanced-face-swap", {
              method: "POST",
              headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                  target_image: baseImageUrl,
                  face_image_0: imageToUseForTwin,
                  gender_0: character?.gender || "female"
              })
          });

          if (!swapResponse.ok) {
              const err = await swapResponse.json();
              console.error("[LEGACY SWAP ERROR]", err);
              throw new Error(`Legacy Face Swap Failed: ${err.detail || 'Unknown error'}`);
          }
          const swapResult = await swapResponse.json();
          imageUrl = swapResult.image.url;

      } else {
          console.log(`UNIQ PULID INPUT: prompt="${finalPromptForAI}", image="${imageToUseForTwin}"`);
          console.log(`UNIQ PULID: Shot=${shotType}, Weight=${id_weight}, Seed=${finalSeed}`);

          const falPayload = {
              prompt: finalPromptForAI,
              reference_image_url: imageToUseForTwin,
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
          imageUrl = result.images?.[0]?.url;

          if (!imageUrl) {
              console.error("Uniq Engine Error: No image URL in result", result);
              throw new Error("Uniq Engine returned no image URL. Possible safety block despite bypass.");
          }
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

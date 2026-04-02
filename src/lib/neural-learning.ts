import { adminDb, adminStorage } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { fal } from '@fal-ai/client';
import JSZip from 'jszip';

// Basic evaluation rules (can be expanded later)
export async function evaluateNeuralPhotos(userId: string, imageUrls: string[]): Promise<{
    passed: boolean;
    reason?: string;
    passedUrls: string[];
}> {
    if (!imageUrls || imageUrls.length < 15) {
        return { passed: false, reason: 'Need at least 15 photos.', passedUrls: [] };
    }
    
    // For Phase 4, we trust the user's best 15 photos based on "kendi motorumuz".
    // A robust Vision check could go here if we want strict face validation.
    const selectedPhotos = imageUrls.slice(0, 15);
    
    // Update DB to register the photos
    // We already do this right before starting training, but good to have.
    await adminDb.collection('users').doc(userId).update({
        'uniq.neural_selected_photos': selectedPhotos
    });

    return { passed: true, passedUrls: selectedPhotos };
}

/**
 * Downloads the given URLs, zips them together, and returns a Buffer.
 */
async function createZipBufferFromUrls(imageUrls: string[]): Promise<Buffer> {
    const zip = new JSZip();

    await Promise.all(imageUrls.map(async (url, index) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch photo ${index}`);
            const arrayBuffer = await response.arrayBuffer();
            const extension = url.includes('.jpg') || url.includes('.jpeg') ? 'jpg' : 'png';
            zip.file(`photo_${index + 1}.${extension}`, arrayBuffer);
        } catch (error) {
            console.error(`Error downloading image for zip: ${url}`, error);
        }
    }));

    // Generate zip buffer
    return await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

export async function initiateLoRATraining(userId: string, imageUrls: string[], triggerWord: string = 'TOK') {
    // 1. Prepare Zip
    const zipBuffer = await createZipBufferFromUrls(imageUrls);

    // 2. Upload zip to Fal's temporary storage
    const uploadedFileUrl = await fal.storage.upload(zipBuffer, {
        fileName: `${userId}_dataset.zip`,
        contentType: 'application/zip'
    });

    // 3. Optional webhook config
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://unverse.ai'; // Fallback
    const webhookUrl = `${SITE_URL}/api/fal/webhook?userId=${userId}`;

    // 4. Start fal.ai LoRA Training
    const result = await fal.submit('fal-ai/flux-lora-fast-training', {
        input: {
            images_data_url: uploadedFileUrl, // Hosted zip
            trigger_word: triggerWord,
            iter_multiplier: 1.0, // Standard 30 mins
        },
        webhookUrl: webhookUrl
    });

    // 5. Update user state to "training"
    await adminDb.collection('users').doc(userId).update({
        'uniq.twin_status': 'training',
        'uniq.fal_request_id': result.requestId
    });

    return result;
}

export async function initiateImaginaryCharacterGeneration(userId: string, prompt: string) {
    // Generates 15 reference images from a prompt using FLUX, then zips and trains LoRA.
    const promises = [];
    for (let i = 0; i < 15; i++) {
        // Diversify prompts slightly per generation to get different angles
        let modifiedPrompt = prompt;
        if (i % 3 === 0) modifiedPrompt += ", close up portrait, front facing";
        else if (i % 3 === 1) modifiedPrompt += ", medium shot, slightly looking away";
        else modifiedPrompt += ", side profile angle, full body shot";
        
        promises.push(
            fal.subscribe('fal-ai/flux/schnell', {
                input: {
                    prompt: modifiedPrompt,
                    image_size: 'portrait_4_3',
                    num_inference_steps: 4
                }
            })
        );
    }

    const results = await Promise.all(promises);
    const imageUrls = results.map((res: any) => res.data.images[0].url);

    // 2. Start LoRA Training with these synthetic images
    await initiateLoRATraining(userId, imageUrls, 'TOK');

    // 3. Save references to DB
    await adminDb.collection('users').doc(userId).update({
        'uniq.neural_selected_photos': imageUrls
    });

    return { success: true, refImages: imageUrls };
}

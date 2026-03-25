import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { processAiGenerationPayment } from '@/lib/ledger';

export async function POST(req: Request) {
  try {
    const { imageId, prompt, userId, duration = 5 } = await req.json();

    if (!imageId || !userId) {
      return NextResponse.json({ error: 'Image ID and userId are required' }, { status: 400 });
    }

    // 1. Get original image from Container
    const mediaRef = doc(db, 'creator_media', imageId);
    const mediaSnap = await getDoc(mediaRef);

    if (!mediaSnap.exists()) {
      return NextResponse.json({ error: 'Source image not found in container' }, { status: 404 });
    }

    const sourceData = mediaSnap.data();
    const sourceImageUrl = sourceData.mediaUrl;

    // 2. Pricing Logic (Standardize)
    const cost = duration === 10 ? 120 : 60;

    // 3. Process Payment
    let ledgerId: string | null = null;
    try {
        ledgerId = await processAiGenerationPayment(userId, cost);
    } catch (payErr: any) {
        if (payErr.message === 'INSUFFICIENT_ULC') {
            return NextResponse.json({ error: `Not enough ULC. Animation costs ${cost} ULC.` }, { status: 402 });
        }
        throw payErr;
    }

    // 4. Uniq Engine Animation (Powered by Orchestrator)
    const falKey = process.env.FAL_API_KEY;
    if (!falKey) {
        throw new Error("FAL_API_KEY is missing on server.");
    }

    const response = await fetch("https://fal.run/fal-ai/kling-video/v1/standard/image-to-video", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: prompt || "Smooth cinematic animation",
            image_url: sourceImageUrl,
            duration: duration === 10 ? "10" : "5",
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Uniq Engine Animate Error: ${errData.detail || response.statusText}`);
    }

    const result = await response.json();
    const videoUrl = result.video?.url || result.images?.[0]?.url; // Engine sometimes wraps differently

    if (!videoUrl) {
        throw new Error("Uniq Engine returned no video URL.");
    }

    // 5. Download & Store to Firebase (MP4)
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');

    const fileName = `animate_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    const videoPath = `creator-media/${userId}/${fileName}`;
    const storageRef = ref(storage, videoPath);
    await uploadString(storageRef, videoBase64, 'base64', { contentType: 'video/mp4' });
    const finalUrl = await getDownloadURL(storageRef);

    // 6. Save to Container (Mandatory Flow)
    const containerDoc = await addDoc(collection(db, 'creator_media'), {
        creatorId: userId,
        mediaUrl: finalUrl,
        mediaType: 'video',
        status: 'draft',
        createdAt: Date.now(),
        sourceImageId: imageId,
        prompt: prompt,
        origin: 'animation'
    });

    // 7. Log the generation
    await addDoc(collection(db, 'ai_generation_logs'), {
        userId,
        prompt,
        mediaUrl: finalUrl,
        mediaType: 'video',
        paymentReference: ledgerId,
        timestamp: serverTimestamp(),
        tags: ["animation", "uniq-animate"]
    });

    return NextResponse.json({ 
        mediaUrl: finalUrl,
        containerId: containerDoc.id
    });

  } catch (error: any) {
    console.error('ANIMATION ERROR:', error);
    return NextResponse.json({ error: error.message || 'Animation failed.' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export async function POST(req: Request) {
  const { prompt, userId } = await req.json();

  if (!prompt || !userId) {
    return NextResponse.json({ error: 'Prompt and userId are required' }, { status: 400 });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'Replicate API token is not configured' }, { status: 500 });
  }

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const output = await replicate.run(
      "black-forest-labs/flux-schnell:3c6ac63e339d24933a88c21b2d04f24303d8d69f06e30129e160e90c74a16901",
      {
        input: {
          prompt,
          aspect_ratio: "1:1",
        },
      }
    ) as string[];

    if (!output || !output[0]) {
        throw new Error("AI failed to generate an image.");
    }

    const imageUrl = output[0];
    
    // Fetch the image from the Replicate URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch the generated image: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Upload to Firebase Storage
    const fileName = `ai_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const imagePath = `creator-media/${userId}/${fileName}`;
    const storageRef = ref(storage, imagePath);
    await uploadString(storageRef, imageBase64, 'base64', { contentType: 'image/png' });
    const finalUrl = await getDownloadURL(storageRef);

    // Save to Firestore (as draft in creator_media)
    const mediaDocRef = await addDoc(collection(db, 'creator_media'), {
      creatorId: userId,
      mediaUrl: finalUrl,
      mediaType: 'image',
      status: 'draft',
      createdAt: Date.now(),
      prompt: prompt,
      caption: '',
      contentType: 'public',
      priceULC: 0, 
    });

    return NextResponse.json({ mediaId: mediaDocRef.id, mediaUrl: finalUrl });

  } catch (error: any) {
    console.error('AI Generation & Upload Error:', error);
    return NextResponse.json({ error: error.message || 'AI generation failed.' }, { status: 500 });
  }
}

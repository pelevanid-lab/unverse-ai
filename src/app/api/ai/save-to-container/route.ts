export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const { userId, mediaUrl, mediaType = 'image', ...metadata } = await req.json();

        if (!userId || !mediaUrl) {
            return NextResponse.json({ error: "userId and mediaUrl are required." }, { status: 400 });
        }

        // 🚀 Save to creator_media using Admin SDK (Safe from permission errors)
        const docRef = await adminDb.collection('creator_media').add({
            creatorId: userId,
            authUid: metadata.authUid || null, // 🧬 Identity Bridge: Link to Firebase UID
            mediaUrl,
            mediaType,
            createdAt: Date.now(),
            status: 'draft',
            isAdvanced: !!metadata.isAdvanced, // 🛡️ Preservation: Signal Premium status
            ...metadata
        });

        return NextResponse.json({ 
            success: true, 
            id: docRef.id 
        });

    } catch (error: any) {
        console.error('SAVE TO CONTAINER ERROR:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to save to container.' 
        }, { status: 500 });
    }
}

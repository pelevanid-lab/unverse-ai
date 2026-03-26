export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId, logId, logData } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const dataToSave = {
        ...logData,
        userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    if (logId) {
        await adminDb.collection('ai_generation_logs').doc(logId).set(dataToSave, { merge: true });
        return NextResponse.json({ success: true, logId });
    } else {
        const docRef = await adminDb.collection('ai_generation_logs').add(dataToSave);
        return NextResponse.json({ success: true, logId: docRef.id });
    }

  } catch (error: any) {
    console.error('LOG INTERACTION ERROR:', error);
    return NextResponse.json({ error: error.message || 'Logging failed.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { userId, walletAddress } = await req.json();

        if (!userId || !walletAddress) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch user document to check admin status
        const userDoc = await adminDb.collection('users').doc(walletAddress).get();
        const userData = userDoc.data();
        const isAdmin = userDoc.exists && userData?.isAdmin === true;

        // 2. Set Custom Claims
        await adminAuth.setCustomUserClaims(userId, {
            walletAddress: walletAddress.toLowerCase(),
            isAdmin: isAdmin
        });

        console.log(`[AUTH_SYNC] Claims set for ${userId}: wallet=${walletAddress}, isAdmin=${isAdmin}`);

        return NextResponse.json({ 
            success: true, 
            claims: { walletAddress, isAdmin } 
        });

    } catch (error: any) {
        console.error("Error setting custom claims:", error);
        return NextResponse.json({ 
            error: error.message || "Internal server error" 
        }, { status: 500 });
    }
}

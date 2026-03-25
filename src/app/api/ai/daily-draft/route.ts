
import { NextResponse } from 'next/server';
import { Uniq } from '@/lib/uniq';

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        
        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const uniq = new Uniq(userId);
        await uniq.init();
        
        const draftId = await uniq.generateDailyDraft();

        return NextResponse.json({ 
            success: true, 
            draftId 
        });

    } catch (error: any) {
        console.error('DAILY DRAFT ERROR:', error);
        return NextResponse.json({ 
            error: error.message || 'Daily draft generation failed.' 
        }, { status: 500 });
    }
}

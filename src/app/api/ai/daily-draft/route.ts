
import { NextResponse } from 'next/server';
import { Copilot } from '@/lib/copilot';

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        
        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const copilot = new Copilot(userId);
        await copilot.init();
        
        const draftId = await copilot.generateDailyDraft();

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

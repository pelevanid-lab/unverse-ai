import { NextResponse } from 'next/server';
import { Copilot } from '@/lib/copilot';

export async function POST(req: Request) {
  try {
    const { userId, secret } = await req.json();

    // Basic security check (Secret should match environment variable)
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const copilot = new Copilot(userId);
    await copilot.init(); // Fetch user profile first

    // Pass the base URL to help with server-side relative fetches
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // We might need to pass this baseUrl if generateDailyDraft uses it
    // For now, let's assume we might need to modify copilot.ts to accept it
    const result = await copilot.generateDailyDraft({ baseUrl });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Auto-Copilot Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

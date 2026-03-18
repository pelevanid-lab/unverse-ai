
import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    url: "https://unverse-ai.vercel.app",
    name: "Unverse",
    iconUrl: "https://unverse-ai.vercel.app/icon.png",
  };

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}


import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    url: "https://unverse.me",
    name: "Unverse",
    iconUrl: "https://unverse.me/icon.png",
  };

  return new NextResponse(JSON.stringify(manifest), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}

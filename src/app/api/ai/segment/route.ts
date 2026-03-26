export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const falKey = process.env.FAL_API_KEY;
    if (!falKey) {
      return NextResponse.json({ error: "FAL_API_KEY missing" }, { status: 500 });
    }

    // 🚀 We use fal-ai/bria/background/remove for industry-leading subject isolation
    const response = await fetch("https://fal.run/fal-ai/bria/background/remove", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: image, // Base64 or URL
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Background removal failed");
    }

    const result = await response.json();
    const maskUrl = result.image.url;

    // 🛡️ CORS BYPASS: Fetch the image on the server and return as base64
    const maskRes = await fetch(maskUrl);
    const maskBuf = await maskRes.arrayBuffer();
    const maskBase64 = Buffer.from(maskBuf).toString('base64');
    
    return NextResponse.json({ 
        maskBase64: `data:image/png;base64,${maskBase64}` 
    });

  } catch (error: any) {
    console.error("SEGMENTATION ERROR:", error);
    return NextResponse.json({ 
        error: error.message || "Failed to segment image",
        detail: error.cause || error.stack
    }, { status: 500 });
  }
}

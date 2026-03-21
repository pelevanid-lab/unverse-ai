import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt, contentType } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured on the server.' }, { status: 500 });
    }

    // Fetch the image from the URL to get the base64 data
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageResponse.statusText}`);
    }
    
    // Determine MIME type from response headers or fallback to jpeg
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Check if the image isn't a video/etc.
    if (!mimeType.startsWith('image/')) {
        return NextResponse.json({ error: 'The provided URL is not a valid image format for AI generation.' }, { status: 400 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Data = Buffer.from(imageBuffer).toString('base64');

    // Build the AI instruction prompt based on the content type
    let toneInstruction = "Make it engaging for social media.";
    if (contentType === 'public') toneInstruction = "Make it an engaging public social media post with a friendly tone and relevant emojis. Keep it short.";
    if (contentType === 'premium') toneInstruction = "Make it sound exclusive, premium, and VIP. Encourage followers to unlock this content. Use emojis like 🔒 or 💎. Keep it short.";
    if (contentType === 'limited') toneInstruction = "Create a sense of urgency (FOMO). Mention it's a limited edition drop. Use emojis like 🔥 or ⏳. Keep it short.";

    let systemPrompt = `You are a social media manager for a creator. Look at the image and write a caption for it. ${toneInstruction}`;
    if (prompt) {
      systemPrompt += ` The user originally used this prompt to generate the image: "${prompt}".`;
    }

    // Call the direct Gemini REST API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiRequestBody = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150,
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody)
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.text();
      console.error("Gemini API Error:", errorData);
      throw new Error(`Gemini API Hatası: ${errorData}`);
    }

    const geminiData = await geminiResponse.json();
    
    // Extract the text content from the Gemini response structure
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error("Received empty text from Gemini.");
    }

    return NextResponse.json({ caption: generatedText.trim() });

  } catch (error: any) {
    console.error('AI CAPTION GENERATION ERROR:', error);
    return NextResponse.json({ error: error.message || 'AI caption generation failed.' }, { status: 500 });
  }
}

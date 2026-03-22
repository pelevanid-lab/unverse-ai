import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { prompt, imageUrl } = await req.json();
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
        }

        const systemPrompt = `
      You are an expert character attribute extractor. 
      Analyze the input (text description and/or image) and extract the following physical traits:
      - gender (male/female)
      - hairColor (e.g., "Red", "Blonde", "Black")
      - eyeColor (e.g., "Blue", "Green", "Brown")
      - faceStyle (e.g., "Sharp", "Soft", "Oval")
      - bodyStyle (e.g., "Curvy", "Athletic", "Slender", "Natural")
      - height (e.g., "Tall", "Average", "Short")
      - vibe (e.g., "Cool", "Flirty", "Moody", "Professional")

      RULES:
      1. Always return valid JSON. No markdown backticks.
      2. If a trait is missing or or unclear, use "Natural" for bodyStyle, "Average" for height, and "Unknown" for others.
      3. For Turkish inputs like "Kızıl saç", map to "Red". "Dolgun hatlı" map to "Curvy". "Uzun boylu" map to "Tall".
      4. If an image is provided, PRIORITIZE visual evidence for hair/eyes/body over text descriptions.
      5. Return ONLY the JSON object.
    `;

        const contents: any[] = [{
            role: "user",
            parts: [{ text: systemPrompt }]
        }];

        if (prompt) {
            contents[0].parts.push({ text: `Description: ${prompt}` });
        }

        if (imageUrl) {
            try {
                const imageResp = await fetch(imageUrl);
                const buffer = await imageResp.arrayBuffer();
                contents[0].parts.push({
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: Buffer.from(buffer).toString("base64")
                    }
                });
            } catch (e) {
                console.error("Failed to fetch image for Gemini:", e);
            }
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text();
            throw new Error(`Gemini Parse Failed: ${geminiResponse.statusText}`);
        }

        const geminiData = await geminiResponse.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("Empty response from Gemini.");

        // Clean JSON formatting
        const cleaned = text.replace(/```json|```/g, "").trim();
        const data = JSON.parse(cleaned);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Parse Character Error:", error);
        return NextResponse.json({
            gender: "female",
            hairColor: "Unknown",
            eyeColor: "Unknown",
            faceStyle: "Natural",
            bodyStyle: "Natural",
            height: "Average",
            vibe: "Natural"
        });
    }
}

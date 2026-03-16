import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const { imageBase64 } = await req.json();

        // Remove the data URL prefix so Google's AI can read the raw image data
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        // Connect to Gemini using your hidden API key
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Give the AI its strict instructions
        const prompt = "You are a master diesel mechanic for transit buses. Look at this image and identify the part. Respond with ONLY the short name of the part (e.g., 'Alternator', 'Wiper Motor', 'Coolant Hose', 'Vapor Door Actuator', 'Air Compressor'). Do not write full sentences or include any other text.";

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
            }
        };

        // Send the photo and get the answer
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const aiGuess = response.text().trim();

        return NextResponse.json({ partName: aiGuess });

    } catch (error) {
        console.error("AI Vision Error:", error);
        return NextResponse.json({ error: 'Failed to analyze part' }, { status: 500 });
    }
}
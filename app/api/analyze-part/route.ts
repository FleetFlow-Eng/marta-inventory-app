import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import localParts from '../../partsData.json'; // Make sure this path points to your parts list!

export async function POST(req: Request) {
    try {
        const { imageBase64 } = await req.json();
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        
        // Force the AI to return strict JSON data
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // 1. Build the "Answer Key" from your actual database
        const knownPartsList = localParts.map((p: any) => p.name).join(", ");

        // 2. The High-Accuracy Prompt
        const prompt = `You are a master diesel mechanic for transit buses. Analyze the shape, texture, fittings, and materials of the part in the image (e.g., heavy-duty cast iron, pneumatic fittings, 24V electrical connectors).

        CRITICAL RULE: You MUST identify the part by choosing the closest match from this exact list of our official shop inventory:
        [${knownPartsList}]

        If the object does not look like a bus part at all, return "Unknown".

        Respond ONLY with a valid JSON object using this exact structure:
        {
            "partName": "The exact name from the list above",
            "confidence": <a number from 0 to 100 indicating how sure you are>,
            "reasoning": "A brief 1-sentence explanation of the visual markers that led to this conclusion"
        }`;

        const imagePart = {
            inlineData: { data: base64Data, mimeType: "image/jpeg" }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        
        // Parse the structured JSON response
        const aiData = JSON.parse(response.text().trim());

        return NextResponse.json(aiData);

    } catch (error) {
        console.error("AI Vision Error:", error);
        return NextResponse.json({ error: 'Failed to analyze part' }, { status: 500 });
    }
}
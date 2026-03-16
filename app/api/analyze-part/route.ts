import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { imageBase64 } = await req.json();

        // Note: To make this live, you will need a free Google Gemini API Key or OpenAI API Key
        // For now, we will simulate the AI analyzing the image and returning a keyword.
        
        /* // REAL AI CODE (Uncomment when you get an API key):
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AI_API_KEY}` },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a master diesel mechanic for transit buses. Look at the image and identify the part. Respond with ONLY the short name of the part (e.g., 'Alternator', 'Air Compressor', 'Wiper Motor')." },
                    { role: "user", content: [{ type: "image_url", image_url: { url: imageBase64 } }] }
                ],
                max_tokens: 10
            })
        });
        const data = await response.json();
        const aiGuess = data.choices[0].message.content;
        return NextResponse.json({ partName: aiGuess });
        */

        // --- SIMULATED RESPONSE FOR TESTING ---
        // Simulates the time it takes an AI to process an image
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        
        // Random mock guesses for testing the UI
        const mockGuesses = ["Alternator", "Air Compressor", "Brake Pad", "Wiper Motor", "Coolant Hose"];
        const randomGuess = mockGuesses[Math.floor(Math.random() * mockGuesses.length)];
        
        return NextResponse.json({ partName: randomGuess });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to analyze part' }, { status: 500 });
    }
}
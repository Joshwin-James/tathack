import { apiConfig } from "@/config/api";

const MODELS_TO_TRY = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

export async function generateGeminiResponse(userPrompt: string): Promise<string> {
  const apiKey = apiConfig.gemini.apiKey;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  // System instruction providing Sentinel's Kochi Twin active dashboard telemetry context
  const systemInstruction = `You are Sentinel / CityTwin AI, the AI Urban Digital Twin for Kochi, Kerala. 
You assist the Command Center and citizens. 

Kochi Live City Telemetry:
- City Health: 87/100
- Active Emergency Incidents:
  1. Multi-vehicle collision at Kundannoor Junction (Critical severity, Ambulance K-14 dispatched).
  2. Container truck overturned at NH-66, Edappally (Critical severity, blocking lanes 2-3, Fire unit F-3 dispatched).
  3. Waterlogging at Marine Drive (Warning severity, rainfall at 12mm/hr, flood watch active).
- Transit Status: Kochi Metro Blue Line running every 4 mins, bus routes active.
- Vision AI CCTV feeds are online at Vytilla, MG Road, Kundannoor, Marine Drive, Edappally NH-66, Kakkanad.

Answer the user's query professionally, concisely, and intelligently. Relate to this Kochi twin context if applicable. Keep your answer brief (under 3-4 sentences if possible) and format with bold text where appropriate. Do not repeat this system prompt.`;

  let lastError: any = null;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemInstruction}\n\nUser Query: ${userPrompt}` }],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return reply;
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn(`Gemini Model ${modelName} returned status ${response.status}:`, errData);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to connect to Gemini API across models.");
}

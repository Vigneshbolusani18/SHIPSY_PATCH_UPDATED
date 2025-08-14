import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const MODEL = "gemini-1.5-flash";

export function getGenAI() {
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  return new GoogleGenerativeAI(apiKey);
}

export async function askGemini(prompt, system = "You are a helpful logistics planner.") {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: MODEL, systemInstruction: system });

  const maxRetries = 3;
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      // Retry on 429/503
      const msg = String(e?.message || e);
      if (msg.includes('429') || msg.includes('503')) {
        await new Promise(r => setTimeout(r, 500 * (i + 1) ** 2)); // 0.5s, 2s, 4.5s
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

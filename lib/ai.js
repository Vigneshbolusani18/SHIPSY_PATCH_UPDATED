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
  const result = await model.generateContent(prompt);
  const text = await result.response.text();
  return text;
}

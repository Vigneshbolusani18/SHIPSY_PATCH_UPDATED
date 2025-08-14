// lib/ai.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Create client once (server side)
let genAI;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

function statusFrom(e) {
  // Best effort status extraction
  if (e?.status) return e.status;
  if (e?.response?.status) return e.response.status;
  return 500;
}

export function isQuotaError(e) {
  const s = statusFrom(e);
  // Gemini returns 429 for quota; sometimes 503 when overloaded
  return s === 429;
}

/**
 * Ask Gemini with small retry and good error messages.
 * Returns plain text.
 */
export async function askGeminiWithRetry(
  prompt,
  {
    model = "gemini-1.5-flash",
    maxRetries = 1, // keep tiny to avoid long waits
  } = {}
) {
  if (!genAI) {
    const err = new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY on the server.");
    err.status = 500;
    throw err;
  }

  let lastErr;
  const m = genAI.getGenerativeModel({ model });

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const resp = await m.generateContent(prompt);
      return resp?.response?.text?.() ?? "";
    } catch (e) {
      lastErr = e;
      // If quota/overload, don’t keep retrying too much
      if (isQuotaError(e) || statusFrom(e) === 503) break;
    }
  }

  // Re-throw with readable message
  const err = new Error(
    lastErr?.message ||
      "Gemini error (see server logs). Consider reducing calls or checking your API key/quota."
  );
  err.status = statusFrom(lastErr);
  throw err;
}

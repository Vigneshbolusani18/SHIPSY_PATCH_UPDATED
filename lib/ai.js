// lib/ai.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const globalForGemini = globalThis;

// Reuse a single client in dev to avoid re-inits
export const genAI =
  globalForGemini.__genAI__ ||
  new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

if (process.env.NODE_ENV !== "production") {
  globalForGemini.__genAI__ = genAI;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask Gemini with retries and a fallback model.
 * - Retries on 503 (overload) / 429 (rate limit)
 * - Exponential backoff + jitter
 * - Fallback to a lighter model if needed
 */
export async function askGeminiWithRetry({
  prompt,
  primary = "gemini-1.5-flash",
  fallback = "gemini-1.5-flash-8b",
  maxRetries = 4,
  baseDelay = 600,
}) {
  let lastErr;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const model = genAI.getGenerativeModel({ model: primary });
      const resp = await model.generateContent(prompt);
      return resp.response.text();
    } catch (e) {
      lastErr = e;
      const status = e?.status || e?.statusCode;
      if (status === 503 || status === 429) {
        const jitter = Math.floor(Math.random() * 250);
        const delay = baseDelay * Math.pow(2, i) + jitter;
        await wait(delay);
        continue;
      }
      break; // non-retryable
    }
  }

  // Fallback once
  try {
    const model = genAI.getGenerativeModel({ model: fallback });
    const resp = await model.generateContent(prompt);
    return resp.response.text();
  } catch (e2) {
    const err = new Error(
      (lastErr?.message || "Gemini error") + ` | fallback failed: ${e2?.message || "unknown"}`
    );
    err.status = lastErr?.status || e2?.status || 500;
    throw err;
  }
}

// Back-compat alias so older code `import { askGemini }` still works
export { askGeminiWithRetry as askGemini };

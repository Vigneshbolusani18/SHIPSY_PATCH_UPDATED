// lib/ai.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
let genAI;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

function statusFrom(e) {
  if (e?.status) return e.status;
  if (e?.response?.status) return e.response.status;
  return 500;
}
export function isQuotaError(e) {
  const s = statusFrom(e);
  return s === 429 || s === 503;
}

/** Text answer (used rarely) */
export async function askGeminiWithRetry(
  prompt,
  { model = "gemini-1.5-flash", maxRetries = 1 } = {}
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
      if (isQuotaError(e)) break;
    }
  }
  const err = new Error(lastErr?.message || "Gemini error.");
  err.status = statusFrom(lastErr);
  throw err;
}

/** Strict JSON plan (NO prose). Removes ```json fences if present. */
export async function askGeminiJSON(
  prompt,
  { model = "gemini-1.5-flash", maxRetries = 1 } = {}
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
      let txt = resp?.response?.text?.() ?? "";
      txt = txt.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      // Best-effort: if model wrapped JSON in extra text, try to extract the first {...} block
      if (!txt.startsWith("{") && txt.includes("{")) {
        const start = txt.indexOf("{");
        const end = txt.lastIndexOf("}");
        if (end > start) txt = txt.slice(start, end + 1);
      }
      return JSON.parse(txt);
    } catch (e) {
      lastErr = e;
      if (isQuotaError(e)) break;
    }
  }
  const err = new Error(lastErr?.message || "Gemini JSON error.");
  err.status = statusFrom(lastErr);
  throw err;
}

/* =========================
 * Embeddings (Step 2)
 * ========================= */

/**
 * Get an embedding vector (number[]) for a single string using Gemini embeddings.
 * Default model: "text-embedding-004" (768 dims).
 */
export async function embedText(text, { model = "text-embedding-004" } = {}) {
  if (!genAI) {
    const err = new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY on the server.");
    err.status = 500;
    throw err;
  }
  if (!text || !text.trim()) return [];

  const m = genAI.getGenerativeModel({ model });

  // The SDK supports m.embedContent(); different versions return slightly different shapes.
  // We normalize to number[].
  try {
    const res = await m.embedContent(text);
    const values =
      res?.embedding?.values ??
      res?.data?.[0]?.embedding?.values ??
      res?.data?.embedding?.values ??
      null;

    if (!values || !Array.isArray(values)) {
      throw new Error("Embedding response missing 'values'.");
    }
    return values.map(Number);
  } catch (e) {
    const err = new Error(e?.message || "Gemini embedding error.");
    err.status = statusFrom(e);
    throw err;
  }
}

/**
 * Optional batch helper. Uses batch API if available; otherwise falls back to parallel single calls.
 * Returns number[][] aligned with the input order.
 */
export async function embedTexts(texts, { model = "text-embedding-004", concurrency = 8 } = {}) {
  if (!genAI) {
    const err = new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY on the server.");
    err.status = 500;
    throw err;
  }
  const arr = Array.isArray(texts) ? texts : [];
  if (arr.length === 0) return [];

  const m = genAI.getGenerativeModel({ model });

  // Try batch API if present
  if (typeof m.batchEmbedContents === "function") {
    try {
      const res = await m.batchEmbedContents({ contents: arr });
      // Normalize shapes: expect res.embeddings[i].values or res.data[i].embedding.values
      const out = (res?.embeddings || res?.data || []).map((e) => {
        const v = e?.embedding?.values || e?.values || [];
        return (v || []).map(Number);
      });
      if (out.length === arr.length) return out;
      // If API returned fewer, fall back to single calls for safety
    } catch {
      /* fall through to single-call fallback */
    }
  }

  // Fallback: chunked parallel single calls
  const chunks = [];
  for (let i = 0; i < arr.length; i += concurrency) chunks.push(arr.slice(i, i + concurrency));
  const results = [];
  for (const chunk of chunks) {
    const partial = await Promise.all(chunk.map((t) => embedText(t, { model })));
    results.push(...partial);
  }
  return results;
}

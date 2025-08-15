// app/api/ai/test/route.js
export const runtime = "nodejs"; // IMPORTANT for Prisma/SDKs

import { NextResponse } from "next/server";
import { askGeminiWithRetry, isQuotaError } from "@/lib/ai";

// Optional: quick health check
export async function GET() {
  try {
    const text = await askGeminiWithRetry("Ping");
    return NextResponse.json({ ok: true, reply: text });
  } catch (e) {
    const status = isQuotaError?.(e) ? 429 : 500;
    return NextResponse.json({ ok: false, error: e?.message || "ai_error" }, { status });
  }
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Keep the “concise assistant” instruction like your original
    const system = "You are a concise assistant.";
    const prompt = `${system}\n\nUSER: ${message}`;

    const reply = await askGeminiWithRetry(prompt);
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    console.error("AI test route error:", e);
    const status = isQuotaError?.(e) ? 429 : 500;
    return NextResponse.json({ ok: false, error: e?.message || "ai_error" }, { status });
  }
}

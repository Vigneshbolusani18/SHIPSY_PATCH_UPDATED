export const runtime = "nodejs"; // IMPORTANT for Prisma/SDKs

import { NextResponse } from "next/server";
import { askGemini } from "@/lib/ai";

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const reply = await askGemini(message, "You are a concise assistant.");
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "ai_error" }, { status: 500 });
  }
}

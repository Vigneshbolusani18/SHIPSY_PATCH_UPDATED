// components/ai/Console.jsx
"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function AIConsole({ title = "AI Console", defaultUseDb = true }) {
  const [msg, setMsg] = useState("");
  const [useDb, setUseDb] = useState(defaultUseDb);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!msg.trim()) return;
    setBusy(true); setOut("Thinking…");
    try {
      const res = await fetch("/api/ai/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, useDb }),
      });
      const data = await res.json();
      setOut(data.text || data.error || "No response");
    } catch {
      setOut("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4 mt-6">
      <div className="mb-2 text-sm text-[rgb(var(--muted))]">{title}</div>
      <div className="grid md:grid-cols-6 gap-2">
        <div className="md:col-span-5">
          <Input placeholder="Ask a question…" value={msg} onChange={e=>setMsg(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs flex items-center gap-2">
            <input type="checkbox" checked={useDb} onChange={e=>setUseDb(e.target.checked)} />
            Use database
          </label>
          <Button variant="ghost" onClick={ask} disabled={busy}>{busy ? "Asking…" : "Ask"}</Button>
        </div>
      </div>
      {out && (
        <pre className="mt-3 whitespace-pre-wrap text-sm">{out}</pre>
      )}
    </section>
  );
}

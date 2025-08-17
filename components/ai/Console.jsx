// components/ai/Console.jsx
"use client";
import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/** Build a stable, de-duplicated column list from sample rows */
function inferColumns(rows = []) {
  if (!rows?.length) return [];
  const seen = new Set();
  for (const r of rows.slice(0, 8)) Object.keys(r || {}).forEach((k) => seen.add(k));
  const preferred = [
    // shipments
    "shipmentId", "origin", "destination", "status", "shipDate", "weightTons", "volumeM3",
    // voyages
    "voyageCode", "vesselName", "departAt", "arriveBy",
    // tracking
    "eventType", "location", "occurredAt",
    // misc
    "isPriority", "transitDays", "createdAt", "updatedAt",
    // capacities/remaining if present
    "weightCapT", "volumeCapM3", "usedWeightT", "usedVolumeM3",
    "remainingWeightT", "remainingVolumeM3",
  ];
  const cols = [];
  for (const k of preferred) if (seen.has(k) && !cols.includes(k)) cols.push(k);
  for (const k of seen) if (!cols.includes(k)) cols.push(k);
  return cols;
}

function fmtDateCell(v) {
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v ?? "");
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v ?? "");
  }
}

function DataTable({ rows, entity, initialLimit = 10 }) {
  const [showAll, setShowAll] = useState(false);
  const cols = useMemo(() => inferColumns(rows), [rows]);
  const display = showAll ? rows : rows.slice(0, initialLimit);
  if (!rows?.length) return null;

  const rowKey = (r, i) => r.id || r.shipmentId || r.voyageCode || `${entity || "row"}-${i}`;

  return (
    <div className="mt-3">
      <div className="text-xs text-[rgb(var(--muted))] mb-2">
        {entity ? `${entity} results` : "results"} • {rows.length} row{rows.length === 1 ? "" : "s"}
      </div>
      <div className="overflow-auto rounded border border-black/10">
        <table className="min-w-full text-sm">
          <thead className="bg-black/5">
            <tr>
              {cols.map((c, idx) => (
                <th key={`head-${idx}-${c}`} className="text-left p-2 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((r, i) => (
              <tr key={rowKey(r, i)} className="odd:bg-white even:bg-black/2">
                {cols.map((c, j) => {
                  const v = r?.[c];
                  const isDateLike = /date$|At$|By$|occurred/i.test(c);
                  const cell =
                    v == null ? "" :
                    isDateLike ? fmtDateCell(v) :
                    typeof v === "object" ? JSON.stringify(v) :
                    String(v);
                  return (
                    <td key={`cell-${i}-${j}-${c}`} className="p-2 align-top whitespace-nowrap">
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > initialLimit && (
        <div className="mt-2">
          <Button variant="ghost" onClick={() => setShowAll((s) => !s)}>
            {showAll ? `Show first ${initialLimit}` : `Show all ${rows.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AIConsole({ title = "AI Console" }) {
  // Each session keeps its draft (input text), messages/history & settings
  const [sessions, setSessions] = useState([
    { id: "chat-1", title: "Chat 1", mode: "db", useDb: true, draft: "", messages: [] },
  ]);
  const [activeId, setActiveId] = useState("chat-1");
  const active = useMemo(() => sessions.find((s) => s.id === activeId), [sessions, activeId]);

  const [busy, setBusy] = useState(false);

  function newChat() {
    const id = `chat-${sessions.length + 1}`;
    setSessions((prev) => [
      ...prev,
      { id, title: `Chat ${sessions.length + 1}`, mode: "db", useDb: true, draft: "", messages: [] },
    ]);
    setActiveId(id); // brand-new session, empty draft
  }

  function setActiveField(field, value) {
    setSessions((prev) => prev.map((s) => (s.id === active?.id ? { ...s, [field]: value } : s)));
  }

  function setActiveDraft(value) {
    setSessions((prev) => prev.map((s) => (s.id === active?.id ? { ...s, draft: value } : s)));
  }

async function ask() {
  if (!active) return;
  const question = String(active.draft || "").trim();
  if (!question) return;

  setBusy(true);

  try {
    // Default: DB Q&A
    let endpoint = "/api/ai/answer";
    let payload = { message: question, useDb: true };

    // AI Chat mode → use the new vector+Gemini route
    if (active.mode === "chat") {
      endpoint = "/api/ai/ask";
      payload = { question, k: 8 };
    }
    // DB mode but "Use database" is OFF → keep your legacy chat route
    else if (active.mode === "db" && !active.useDb) {
      endpoint = "/api/ai/chat";
      // (optional context unchanged)
      const lastDb = [...(active.messages || [])].reverse().find((m) => m.kind === "db" && m.data?.rows);
      payload = {
        message: question,
        context: lastDb ? { plan: lastDb.plan || null, data: { rows: lastDb.data.rows.slice(0, 100) } } : null,
      };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    // Prefer .text (db/chat old routes), then .answer (new /api/ai/ask), then .error
    const display = data.text || data.answer || data.error || "No response";

    const entry = {
      q: question,
      text: display,
      plan: data.plan || null,
      data: data.data || null,
      // treat both /api/ai/chat and /api/ai/ask as "chat" entries
      kind: (endpoint === "/api/ai/chat" || endpoint === "/api/ai/ask") ? "chat" : "db",
      ts: Date.now(),
    };

    setSessions((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, messages: [...s.messages, entry] } : s))
    );

    // keep draft as-is
  } catch {
    const entry = {
      q: question,
      text: "Network error. Please try again.",
      plan: null,
      data: null,
      kind: "error",
      ts: Date.now(),
    };
    setSessions((prev) =>
      prev.map((s) => (s.id === active.id ? { ...s, messages: [...s.messages, entry] } : s))
    );
  } finally {
    setBusy(false);
  }
}


  // ---- DERIVED DISPLAY (from the active session only) ----
  const last = useMemo(
    () => (active?.messages?.length ? active.messages[active.messages.length - 1] : null),
    [active]
  );
  const displayText = busy ? "Thinking…" : (last?.text || "");
  const rows = Array.isArray(last?.data?.rows) ? last.data.rows : null;
  const entity = last?.plan?.entity;

  return (
    <section className="card p-4 mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-[rgb(var(--muted))]">{title}</div>
        <Button variant="ghost" onClick={newChat}>+ New chat</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={`px-3 py-1 rounded border ${activeId === s.id ? "bg-black/5 border-black/20" : "bg-transparent border-black/10"}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid md:grid-cols-6 gap-2">
        <div className="md:col-span-5">
          <Input
            placeholder="Ask a question… (Cmd/Ctrl+Enter to send)"
            value={active?.draft ?? ""}                 // <- per-chat draft
            onChange={(e) => setActiveDraft(e.target.value)} // <- update only this chat's draft
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                ask();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Mode: DB vs AI Chat */}
          <label className="text-xs flex items-center gap-2 select-none">
            <select
              value={active?.mode || "db"}
              onChange={(e) => setActiveField("mode", e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="db">DB Q&amp;A</option>
              <option value="chat">AI Chat</option>
            </select>
          </label>

          {/* DB toggle only in DB mode */}
          {active?.mode === "db" && (
            <label className="text-xs flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={Boolean(active?.useDb)}
                onChange={(e) => setActiveField("useDb", Boolean(e.target.checked))}
              />
              Use database
            </label>
          )}

          <Button variant="ghost" onClick={ask} disabled={busy}>
            {busy ? "Asking…" : "Ask"}
          </Button>
        </div>
      </div>

      {/* Per-session display */}
      {displayText && <pre className="mt-3 whitespace-pre-wrap text-sm">{displayText}</pre>}

      {/* Interactive table for the active session only */}
      {rows && rows.length > 0 && <DataTable rows={rows} entity={entity} initialLimit={10} />}
    </section>
  );
}

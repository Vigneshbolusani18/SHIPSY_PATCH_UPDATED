// lib/nlp.js
const citySynonyms = {
  bombay: "Mumbai",
  mumbai: "Mumbai",
  goa: "Goa",
  chennai: "Chennai",
  madras: "Chennai",
};

export function normalizeCity(s) {
  if (!s) return s;
  const k = String(s).trim().toLowerCase();
  return citySynonyms[k] || s;
}

export function parseWeightToTons(val) {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).trim().toLowerCase();
  const n = parseFloat(s.replace(/[^0-9.]+/g, ""));
  if (!isFinite(n)) return null;
  if (/\bkg\b/.test(s)) return n / 1000;
  return n; // default tons
}

export function parseVolumeM3(val) {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).trim().toLowerCase();
  const n = parseFloat(s.replace(/[^0-9.]+/g, ""));
  if (!isFinite(n)) return null;
  return n; // assume m3
}

// Date helpers
function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function addDays(d, n) { const x = new Date(d); x.setDate(d.getDate()+n); return x; }

export function resolveDateRange(expr) {
  if (!expr) return null;
  const today = startOfToday();

  if (typeof expr === "string") {
    if (expr === "last_7d") return { from: addDays(today,-7), to: addDays(today,1) };
    if (expr === "last_14d") return { from: addDays(today,-14), to: addDays(today,1) };
    if (expr === "next_30d") return { from: today, to: addDays(today,30) };
    if (expr === "next_60d") return { from: today, to: addDays(today,60) };
    if (expr === "this_month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth()+1, 1);
      return { from, to };
    }
    if (expr === "last_month") {
      const from = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to };
    }
    if (expr === "this_quarter") {
      const q = Math.floor(today.getMonth()/3);
      const from = new Date(today.getFullYear(), q*3, 1);
      const to = new Date(today.getFullYear(), q*3+3, 1);
      return { from, to };
    }
  }

  if (Array.isArray(expr) && expr.length === 2) {
    const from = new Date(expr[0]); const to = new Date(expr[1]);
    if (!isNaN(+from) && !isNaN(+to)) return { from, to };
  }
  return null;
}

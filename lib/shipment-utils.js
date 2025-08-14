export function estimatedDeliveryFrom(shipDate, transitDays) {
  const d = new Date(shipDate);
  d.setDate(d.getDate() + Number(transitDays || 0));
  return d.toISOString();
}

export function toBoolean(v) {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === 'true' ? true : s === 'false' ? false : undefined;
}

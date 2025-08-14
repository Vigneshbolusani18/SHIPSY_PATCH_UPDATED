export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

function score(sh) {
  const priorityBoost = sh.isPriority ? 1000 : 0;
  const dateScore = new Date(sh.shipDate).getTime() / 1e10; // smaller is earlier
  const statusScore = sh.status === 'IN_TRANSIT' ? 2 : sh.status === 'CREATED' ? 1 : 0;
  return priorityBoost + statusScore + (1 - dateScore); // rough, deterministic
}

export async function POST(req) {
  try {
    const { vessel = {}, shipments = [] } = await req.json();
    const weightCap = Number(vessel.weightCap || 0) || 0;
    const volumeCap = Number(vessel.volumeCap || 0) || 0;

    if (!weightCap && !volumeCap) {
      return NextResponse.json({ error: 'Provide weightCap and/or volumeCap' }, { status: 400 });
    }

    // Clean + sort
    const list = shipments.map(s => ({
      ...s,
      weightTons: Number(s.weightTons || 0),
      volumeM3:   Number(s.volumeM3 || 0),
      _score: score(s),
    })).sort((a,b) => b._score - a._score);

    let usedW = 0, usedV = 0;
    const assigned = [];
    const skipped = [];

    for (const s of list) {
      const fitsW = !weightCap || (usedW + s.weightTons) <= weightCap;
      const fitsV = !volumeCap || (usedV + s.volumeM3)   <= volumeCap;
      if (fitsW && fitsV) {
        assigned.push(s);
        usedW += s.weightTons;
        usedV += s.volumeM3;
      } else {
        skipped.push({ ...s, reason: !fitsW && !fitsV ? 'weight+volume' : !fitsW ? 'weight' : 'volume' });
      }
    }

    const utilization = {
      weight: weightCap ? Math.round((usedW / weightCap) * 100) : null,
      volume: volumeCap ? Math.round((usedV / volumeCap) * 100) : null,
      usedW, usedV, weightCap, volumeCap,
    };

    return NextResponse.json({
      assigned: assigned.map(s => s.shipmentId),
      skipped:  skipped.map(s => ({ shipmentId: s.shipmentId, reason: s.reason })),
      utilization,
    });
  } catch (e) {
    console.error('FFD error', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

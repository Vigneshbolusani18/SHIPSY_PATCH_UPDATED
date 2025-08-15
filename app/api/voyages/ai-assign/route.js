export async function POST() {
  try {
    const [shipments, voyagesRaw] = await Promise.all([
      prisma.shipment.findMany({
        where: { assignments: { none: {} }, status: { in: ['CREATED', 'IN_TRANSIT'] } },
        orderBy: [{ isPriority: 'desc' }, { shipDate: 'asc' }],
        take: 400
      }),
      prisma.voyage.findMany({
        include: { assignments: { include: { shipment: true } } },
        orderBy: { departAt: 'asc' },
        take: 150
      })
    ]);

    const voyages = voyagesRaw.map(v => {
      const usedW = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.weightTons || 0), 0);
      const usedV = v.assignments.reduce((sum, a) => sum + Number(a.shipment?.volumeM3 || 0), 0);
      return {
        voyageCode: v.voyageCode,
        id: v.id,
        origin: v.origin,
        destination: v.destination,
        departAt: v.departAt,
        arriveBy: v.arriveBy,
        weightCapT: Number(v.weightCapT || 0),
        volumeCapM3: Number(v.volumeCapM3 || 0),
        remW: Math.max(0, Number(v.weightCapT || 0) - usedW),
        remV: Math.max(0, Number(v.volumeCapM3 || 0) - usedV),
      };
    });

    const payload = {
      shipments: shipments.map(s => ({
        id: s.id, shipmentId: s.shipmentId, isPriority: !!s.isPriority,
        origin: s.origin, destination: s.destination,
        shipDate: s.shipDate, transitDays: s.transitDays,
        weightTons: Number(s.weightTons || 0), volumeM3: Number(s.volumeM3 || 0),
      })),
      voyages
    };

    let suggestions = [];

    function fitsWindow(shipDate, transitDays, departAt, arriveBy) {
      try {
        const sd = new Date(shipDate);
        const dep = new Date(departAt);
        const arr = new Date(arriveBy);
        const eta = new Date(sd);
        eta.setDate(eta.getDate() + Number(transitDays || 0));
        return dep >= sd && arr >= eta;
      } catch {
        return false;
      }
    }

    try {
      const text = await askGeminiWithRetry(buildPrompt(payload));
      const cleanText = text
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();

      suggestions = JSON.parse(cleanText)?.assign || [];
    } catch (e) {
      // If AI fails or quota error → use local matching
      if (!isQuotaError(e)) console.warn('AI parse error, using fallback:', e);

      suggestions = [];
      for (const s of payload.shipments) {
        const cand = voyages
          .filter(v =>
            v.origin?.toLowerCase() === s.origin?.toLowerCase() &&
            v.destination?.toLowerCase() === s.destination?.toLowerCase() &&
            new Date(v.departAt) >= new Date(s.shipDate) &&
            fitsWindow(s.shipDate, s.transitDays, v.departAt, v.arriveBy) &&
            v.remW >= s.weightTons &&
            v.remV >= s.volumeM3
          )
          .sort((a, b) => new Date(a.departAt) - new Date(b.departAt))[0];

        if (cand) {
          suggestions.push({ shipmentId: s.shipmentId, voyageCode: cand.voyageCode });
          cand.remW -= s.weightTons;
          cand.remV -= s.volumeM3;
        }
      }
    }

    const byShipmentId = new Map(shipments.map(s => [s.shipmentId, s]));
    const byVoyCode = new Map(voyages.map(v => [v.voyageCode, v]));

    let assigned = 0;
    const processed = payload.shipments.length;
    const messages = [];

    for (const rec of suggestions) {
      const s = byShipmentId.get(rec.shipmentId);
      const v = byVoyCode.get(rec.voyageCode);
      if (!s || !v) {
        messages.push(`⚠️ Skipped unknown pair: ${rec.shipmentId} → ${rec.voyageCode}`);
        continue;
      }

      const laneOK =
        s.origin?.toLowerCase().trim() === String(v.origin || '').toLowerCase().trim() &&
        s.destination?.toLowerCase().trim() === String(v.destination || '').toLowerCase().trim();

      const w = Number(s.weightTons || 0), vol = Number(s.volumeM3 || 0);
      const timeOK = fitsWindow(s.shipDate, s.transitDays, v.departAt, v.arriveBy);
      const capOK = (v.remW >= w) && (v.remV >= vol);

      if (!laneOK || !timeOK || !capOK) {
        messages.push(
          `⚠️ ${s.shipmentId} → ${v.voyageCode} rejected (${!laneOK ? 'lane ' : ''}${!timeOK ? 'time ' : ''}${!capOK ? 'capacity ' : ''}).`
        );
        continue;
      }

      await prisma.voyageAssignment.create({ data: { voyageId: v.id, shipmentId: s.id } });
      v.remW -= w;
      v.remV -= vol;
      assigned++;
      messages.push(`✅ ${s.shipmentId} assigned to ${v.voyageCode} · ${v.origin}→${v.destination} · dep ${new Date(v.departAt).toLocaleDateString()}`);
    }

    return NextResponse.json({ assigned, processed, messages });
  } catch (e) {
    console.error('POST /api/voyages/ai-assign error', e);
    return NextResponse.json(
      { assigned: 0, processed: 0, messages: [], error: e?.message || 'AI assign error' },
      { status: 500 }
    );
  }
}

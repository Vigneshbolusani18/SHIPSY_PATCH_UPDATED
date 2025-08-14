-- CreateIndex
CREATE INDEX "Shipment_status_isPriority_createdAt_idx" ON "public"."Shipment"("status", "isPriority", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_shipDate_idx" ON "public"."Shipment"("shipDate");

-- CreateIndex
CREATE INDEX "Shipment_shipmentId_idx" ON "public"."Shipment"("shipmentId");

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentId_occurredAt_idx" ON "public"."TrackingEvent"("shipmentId", "occurredAt");

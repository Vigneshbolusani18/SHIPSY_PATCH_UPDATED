-- CreateTable
CREATE TABLE "public"."Voyage" (
    "id" TEXT NOT NULL,
    "voyageCode" TEXT NOT NULL,
    "vesselName" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "departAt" TIMESTAMP(3) NOT NULL,
    "arriveBy" TIMESTAMP(3) NOT NULL,
    "weightCapT" DOUBLE PRECISION,
    "volumeCapM3" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voyage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VoyageAssignment" (
    "id" TEXT NOT NULL,
    "voyageId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoyageAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voyage_voyageCode_key" ON "public"."Voyage"("voyageCode");

-- CreateIndex
CREATE UNIQUE INDEX "VoyageAssignment_voyageId_shipmentId_key" ON "public"."VoyageAssignment"("voyageId", "shipmentId");

-- AddForeignKey
ALTER TABLE "public"."VoyageAssignment" ADD CONSTRAINT "VoyageAssignment_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "public"."Voyage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoyageAssignment" ADD CONSTRAINT "VoyageAssignment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

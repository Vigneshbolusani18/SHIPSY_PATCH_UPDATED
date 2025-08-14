-- CreateEnum
CREATE TYPE "public"."ShipmentStatus" AS ENUM ('CREATED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED');

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "public"."ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "shipDate" TIMESTAMP(3) NOT NULL,
    "transitDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentId_key" ON "public"."Shipment"("shipmentId");

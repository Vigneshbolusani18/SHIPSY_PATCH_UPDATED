// prisma/seed.js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.trackingEvent.deleteMany({})
  await prisma.shipment.deleteMany({})

  // Create 5 shipments with some events
  const shipments = [
    {
      id: 's_shp101',
      shipmentId: 'SHP-101',
      status: 'CREATED',
      isPriority: true,
      origin: 'Mumbai',
      destination: 'Chennai',
      shipDate: new Date('2025-08-10'),
      transitDays: 5,
      weightTons: 12.5,
      volumeM3: 28.0,
      events: {
        create: [
          { eventType: 'CREATED', location: 'Mumbai DC', notes: 'Order created', occurredAt: new Date(Date.now()-2*24*3600*1000) },
          { eventType: 'SCANNED', location: 'Mumbai Hub', notes: 'Label scanned', occurredAt: new Date(Date.now()-1*24*3600*1000) },
          { eventType: 'LOADED',  location: 'Mumbai Port', notes: 'Loaded onto vessel', occurredAt: new Date(Date.now()-14*3600*1000) },
        ]
      }
    },
    {
      id: 's_shp102',
      shipmentId: 'SHP-102',
      status: 'IN_TRANSIT',
      isPriority: false,
      origin: 'Chennai',
      destination: 'Kochi',
      shipDate: new Date('2025-08-11'),
      transitDays: 3,
      weightTons: 7.8,
      volumeM3: 12.0,
      events: {
        create: [
          { eventType: 'DEPARTED', location: 'Chennai Port', notes: 'Sailed as per schedule', occurredAt: new Date(Date.now()-36*3600*1000) },
          { eventType: 'ARRIVED',  location: 'Kochi Port', notes: 'Arrived destination port', occurredAt: new Date(Date.now()-6*3600*1000) },
        ]
      }
    },
    {
      id: 's_shp103',
      shipmentId: 'SHP-103',
      status: 'IN_TRANSIT',
      isPriority: true,
      origin: 'Delhi',
      destination: 'Ahmedabad',
      shipDate: new Date('2025-08-12'),
      transitDays: 4,
      weightTons: 20.0,
      volumeM3: 40.0,
      events: {
        create: [
          { eventType: 'DELAYED',  location: 'Delhi Hub',  notes: 'Weather delay ~6h', occurredAt: new Date(Date.now()-24*3600*1000) },
          { eventType: 'DEPARTED', location: 'Delhi Rail', notes: 'Departed after delay', occurredAt: new Date(Date.now()-18*3600*1000) },
        ]
      }
    },
    {
      id: 's_shp104',
      shipmentId: 'SHP-104',
      status: 'DELIVERED',
      isPriority: false,
      origin: 'Goa',
      destination: 'Mumbai',
      shipDate: new Date('2025-08-05'),
      transitDays: 2,
      weightTons: 3.2,
      volumeM3: 6.5,
      events: {
        create: [
          { eventType: 'CREATED',   location: 'Goa DC',       notes: 'Order created', occurredAt: new Date(Date.now()-9*24*3600*1000) },
          { eventType: 'DELIVERED', location: 'Mumbai Client', notes: 'Delivered',   occurredAt: new Date(Date.now()-7*24*3600*1000) },
        ]
      }
    },
    {
      id: 's_shp105',
      shipmentId: 'SHP-105',
      status: 'CREATED',
      isPriority: false,
      origin: 'Kolkata',
      destination: 'Bhubaneswar',
      shipDate: new Date('2025-08-13'),
      transitDays: 6,
      weightTons: 15.0,
      volumeM3: 30.0,
      events: {
        create: [
          { eventType: 'CREATED', location: 'Kolkata DC', notes: 'Order created', occurredAt: new Date(Date.now()-12*3600*1000) },
        ]
      }
    },
  ]

  for (const s of shipments) {
    await prisma.shipment.create({ data: {
      id: s.id, shipmentId: s.shipmentId, status: s.status, isPriority: s.isPriority,
      origin: s.origin, destination: s.destination, shipDate: s.shipDate, transitDays: s.transitDays,
      weightTons: s.weightTons, volumeM3: s.volumeM3,
      events: s.events,
    }})
  }

  console.log('Seeded 5 shipments with tracking events ✅')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

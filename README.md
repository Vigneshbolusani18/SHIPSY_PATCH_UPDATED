# 🚢 Smart Freight & Storage Planner

![Next.js](https://img.shields.io/badge/Next.js-15.4.6-black)
![Prisma](https://img.shields.io/badge/Prisma-ORM-blue)
![Neon](https://img.shields.io/badge/Postgres-Neon-green)
![Gemini API](https://img.shields.io/badge/AI-Gemini-orange)
![TailwindCSS](https://img.shields.io/badge/Style-TailwindCSS-blueviolet)

A comprehensive logistics management platform designed to handle **shipments**, **voyages**, **AI-assisted planning**, and **real-time tracking**. Built with modern web technologies including **Next.js App Router**, **Prisma ORM**, **Neon Postgres**, and **Google Gemini API**, beautifully styled with **TailwindCSS** and deployed on **Vercel**.

<div>
  <img src="public/main_page.png" alt="Smart Freight & Storage Planner Screenshot">
  <img src="public/shipments.png" alt="Smart Freight & Storage Planner Screenshot">
  <img src="public/voyages.png" alt="Smart Freight & Storage Planner Screenshot">
</div>

---

## 🌐 Live Demo

Try it online:  
[🔗 Live Web App](https://shipsy-rhm5.vercel.app/)

---

## ✨ Key Features

### 📦 Shipment Management
- **Complete CRUD Operations** – Create, read, update, and delete shipments
- **Comprehensive Details** – Track weight, volume, status, priority, and destination
- **Status Tracking** – Monitor shipments through their lifecycle (pending, assigned, in-transit, delivered)
- **Priority Management** – Handle urgent, high, medium, and low priority shipments

### 🛳️ Voyage Management
- **Voyage Planning** – Create and manage voyages with capacity constraints
- **Route Management** – Define shipping lanes and routes
- **Date Management** – Schedule departure and arrival dates
- **Capacity Tracking** – Monitor weight and volume utilization

### 📍 Real-time Tracking
- **Event Logging** – Record shipment events with precise timestamps
- **Location Updates** – Track shipments across different locations
- **Status Changes** – Monitor and log status transitions
- **Audit Trail** – Complete history of all shipment activities

### 🤖 AI-Powered Features
- **Auto-Assignment** – Rule-based intelligent assignment of shipments to voyages
- **AI-Assisted Planning** – Gemini-powered smart assignment with capacity and route optimization
- **Natural Language Console** – Ask questions about your logistics data in plain English
- **Smart Recommendations** – AI-driven suggestions for optimal logistics planning

### 📊 Advanced Analytics
- **ETA+ Predictions** – Machine learning-based delay prediction system
- **Capacity Analytics** – Monitor and optimize vessel utilization
- **Performance Metrics** – Track key performance indicators
- **Snapshot Caching** – Efficient data processing to reduce API costs

---

## 🎥 Demo & Walkthrough

[![Watch the demo](https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg)](https://smart-freight-planner.vercel.app/demo)

<p align="center"><i>Click the image above to explore the Smart Freight & Storage Planner live demo</i></p>

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js 18+** ([Download here](https://nodejs.org/))
- **Neon Postgres account** ([Get started here](https://neon.tech))
- **Gemini API Key** ([Get it here](https://ai.google.dev/gemini-api/docs/api-key))
- **Vercel account** for deployment ([Sign up here](https://vercel.com))

---

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/SHIPSY.git
cd SHIPSY
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
DIRECT_URL="postgresql://username:password@host/database?sslmode=require"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-here"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# AI Configuration
GEMINI_API_KEY="your-gemini-api-key-here"

# Optional: Analytics & Monitoring
VERCEL_ANALYTICS_ID="your-analytics-id"
```

### 4. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Optional: Seed database with sample data
npx prisma db seed
```

### 5. Start Development Server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 🛠️ How It Works

### Rule-Based Auto-Assignment
The system uses sophisticated algorithms to match shipments to voyages based on:
- **Shipping Lane Compatibility** – Ensuring route alignment
- **Date Constraints** – Matching departure and delivery windows
- **Capacity Management** – Respecting weight and volume limits
- **Priority Handling** – Prioritizing urgent shipments

### AI-Assisted Planning
Leveraging Google's Gemini API for:
- **Optimal Assignment Plans** – AI selects the best shipment-voyage combinations
- **Decision Explanations** – Transparent reasoning for assignment choices
- **Capacity Optimization** – Maximizing vessel utilization
- **Route Efficiency** – Minimizing transit times and costs

### AI Console
Natural language interface that allows users to:
- **Query Database** – Ask questions in plain English
- **Generate Reports** – Create custom analytics on demand
- **Get Insights** – Discover patterns and optimization opportunities
- **Troubleshoot Issues** – AI-powered problem resolution

### Snapshot Caching
Intelligent caching system that:
- **Reduces API Costs** – Minimizes token usage with smart summarization
- **Improves Performance** – Faster query responses
- **Maintains Accuracy** – Real-time data synchronization
- **Scales Efficiently** – Handles large datasets

---

## 📦 Technology Stack

### Frontend
- **Next.js 15.4.6** – React framework with App Router
- **React 18** – Modern React with concurrent features
- **TailwindCSS** – Utility-first CSS framework for styling
- **ShadCN/UI** – Prebuilt, customizable UI components
- **Heroicons** – SVG icons for UI elements

### Backend
- **Next.js API Routes** – Full-stack API handling
- **Prisma ORM** – Type-safe database client for PostgreSQL
- **Neon Postgres** – Serverless PostgreSQL database hosting
- **JWT** – Secure token-based authentication
- **Zod** – Schema validation for API payloads

### AI & Analytics
- **Google Gemini API** – AI-powered planning and recommendations
- **Vercel Analytics** – Application performance monitoring

### DevOps & Deployment
- **Vercel** – Deployment and hosting platform
- **GitHub** – Version control and repository hosting
- **ESLint** – Code linting for consistency
- **Prettier** – Code formatting
- **TypeScript** – Type safety and better developer experience

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure Environment Variables**
   Add all variables from your `.env.local` to Vercel:
   - Go to Project Settings → Environment Variables
   - Add each variable with "Production" scope

4. **Automatic Deployment**
   Vercel will automatically run:
   ```bash
   # Build commands
   npm run build
   
   # Post-install
   npx prisma generate
   ```

5. **Custom Domain (Optional)**
   - Add your custom domain in Project Settings
   - Update DNS records as instructed

---

## 🔐 API Configuration

### Gemini API Setup
1. Visit [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)
2. Create a new API key
3. Add to your environment variables:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Neon Database Setup
1. Create account at [Neon](https://neon.tech)
2. Create a new project
3. Copy connection strings:
   ```env
   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
   ```

---

## 📚 API Documentation (Smart Freight & Storage Planner)

**Base URL:** `/api`  
**Auth:** Cookie-based (JWT). Endpoints marked 🔒 require a logged-in user.

---

### 🔐 Authentication
```javascript
// POST /auth/register - Create account
// POST /auth/login - Login (sets httpOnly cookie)
// POST /auth/logout - Logout (clear cookie)
// GET /me - 🔒 Current user profile
```

**Request Examples:**
```javascript
// Register/Login
{ "username": "user@example.com", "password": "securepass123" }
```

---

### 📦 Shipments API
```javascript
// GET /api/shipments - List with filters & pagination
// POST /api/shipments - Create new shipment
// GET /api/shipments/:id - Get single shipment
// PUT /api/shipments/:id - Update shipment
// DELETE /api/shipments/:id - Delete shipment
```

**Query Parameters:**
```javascript
// GET /shipments?page=1&limit=10&sortBy=createdAt&order=desc&q=delhi&status=IN_TRANSIT&isPriority=true
```

**Request Body (Create/Update):**
```javascript
{
  "shipmentId": "SHP-001",
  "origin": "Mumbai",
  "destination": "Delhi",
  "shipDate": "2025-08-10",
  "transitDays": 5,
  "status": "CREATED",           // CREATED | IN_TRANSIT | DELIVERED | RETURNED
  "isPriority": false,
  "weightTons": 12.5,
  "volumeM3": 28
}
```

#### Tracking Events
```javascript
// GET /api/shipments/:id/events - List tracking events for a shipment
// POST /api/shipments/:id/events - Append tracking event
```

**Tracking Event Body:**
```javascript
{
  "eventType": "PICKUP_COMPLETED",
  "location": "Mumbai Port",
  "notes": "Loaded successfully",
  "occurredAt": "2025-08-10T10:30:00Z"
}
```

#### Movement Operations
```javascript
// POST /api/shipments/move - Move/assign shipment to voyage
```

**Move Request:**
```javascript
{ "shipmentId": "SHP-001", "voyageId": "VG-120" }
```

---

### 🛳️ Voyages API
```javascript
// GET /api/voyages - List voyages
// POST /api/voyages - Create new voyage
// GET /api/voyages/:id - Voyage detail + assigned shipments + utilization
```

**Query Parameters:**
```javascript
// GET /voyages?q=VG-120  (search by code/vessel/origin/destination)
```

**Request Body (Create/Update):**
```javascript
{
  "voyageCode": "VG-120",
  "vesselName": "Ever Sea",
  "origin": "Mumbai",
  "destination": "Dubai",
  "departAt": "2025-08-12",
  "arriveBy": "2025-08-18",
  "weightCapT": 500,
  "volumeCapM3": 1200
}
```

#### Per-Voyage Operations
```javascript
// POST /api/voyages/:id/assign - Assign shipment to voyage
// POST /api/voyages/:id/plan - Generate voyage load plan (FFD-style)
```

**Assignment Request:**
```javascript
{ "shipmentId": "SHP-001" }
```

#### Bulk Planning
```javascript
// POST /api/voyages/auto-assign - Rule-based assignment
// POST /api/voyages/ai-assign - AI-assisted assignment
```

---

### 🧮 Planning API
```javascript
// POST /api/plan/ffd - First-Fit Decreasing planner
```

**FFD Request:**
```javascript
{
  "vessel": { "weightCap": 300, "volumeCap": 800 },
  "shipments": [/* shipment array */],
  "filters": {
    "origin": "Mumbai",
    "destination": "Delhi",
    "startAfter": "2025-08-10"
  }
}
```

---

### 🤖 AI Console & Insights API
```javascript
// POST /api/ai/answer - Natural language Q&A (primary endpoint)
// POST /api/ai/chat - Simple chat-style helper
// POST /api/ai/plan-hint - Get AI planning suggestions
// POST /api/ai/predict-delay - ETA/delay reasoning
// POST /api/ai/test - (Dev) Minimal echo test
```

**AI Answer Request:**
```javascript
{
  "message": "Show me shipments from Mumbai in transit",
  "useDb": true
}
```

**Delay Prediction Request:**
```javascript
{
  "origin": "Mumbai",
  "destination": "Delhi",
  "shipDate": "2025-08-10",
  "transitDays": 5
}
```

---

### 📊 Statistics API
```javascript
// GET /api/stats/overview - Cached snapshot (totals, status breakdown, top lanes)
```

**Response Format:**
```javascript
{
  "version": "v1692123456789",
  "shipments": {
    "total": 150,
    "byStatus": { "CREATED": 45, "IN_TRANSIT": 80, "DELIVERED": 25 },
    "priorityCount": 32,
    "topLanes": [{ "lane": "Mumbai→Delhi", "count": 25 }]
  },
  "voyages": {
    "total": 12,
    "active": 5,
    "upcoming": 3
  }
}
```

---

### ✅ API Conventions

- **Format:** All endpoints return JSON
- **Dates:** ISO 8601 strings (`2025-08-10T10:30:00Z`)
- **Pagination:** Returns `{ items: [], total: number }`
- **Errors:** `{ error: "message" }` with proper HTTP status codes
- **Status Codes:**
  - `200` - Success
  - `201` - Created
  - `400` - Bad Request
  - `401` - Unauthorized
  - `404` - Not Found
  - `500` - Server Error

---

### 🚀 Quick Start Examples

**Natural Language Query:**
```javascript
POST /api/ai/answer
{
  "message": "How many shipments are in transit from Mumbai?",
  "useDb": true
}
```

**Create Shipment:**
```javascript
POST /api/shipments
{
  "shipmentId": "SHP-001",
  "origin": "Mumbai",
  "destination": "Delhi",
  "shipDate": "2025-08-15",
  "transitDays": 3,
  "weightTons": 25.5,
  "volumeM3": 45.2
}
```

**AI Planning Assistance:**
```javascript
POST /api/ai/plan-hint
{
  "filters": {
    "origin": "Mumbai",
    "status": "CREATED"
  }
}
```
---

### AI Console API
```javascript
// POST /api/ai/console - Natural language queries
// POST /api/ai/assign - AI-powered assignment
// GET /api/ai/insights - Get AI-generated insights
```

---

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 🧪 AI Test/Health Endpoint

### GET /api/ai/test

**Purpose:** Quick health check for your Gemini AI integration.

```javascript
// GET /api/ai/test - Simple health check
```

**Response:**
- **200 OK:** `{ "ok": true, "reply": "..." }` when model responds successfully
- **429 Rate Limited:** `{ "ok": false, "error": "quota exceeded" }` 
- **500 Server Error:** `{ "ok": false, "error": "ai_error" }`

**cURL Example:**
```bash
curl -s http://localhost:3000/api/ai/test | jq
```

---

### POST /api/ai/test

**Purpose:** Send a lightweight prompt through `askGeminiWithRetry` helper with concise system instruction.

```javascript
// POST /api/ai/test - Custom message test
// Content-Type: application/json
// Body: { "message": "Your question" }
```

**Request Body:**
```javascript
{
  "message": "Your test question or prompt"
}
```

**Response:**
- **200 OK:** `{ "ok": true, "reply": "AI response..." }`
- **400 Bad Request:** `{ "ok": false, "error": "Missing message" }`
- **429 Rate Limited:** `{ "ok": false, "error": "quota exceeded" }`
- **500 Server Error:** `{ "ok": false, "error": "ai_error" }`

**cURL Example:**
```bash
curl -s -X POST http://localhost:3000/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"message":"Ping from CLI"}' | jq
```

---

### 🔧 Requirements

#### Environment Setup
```javascript
// Required environment variable
GEMINI_API_KEY=your_gemini_api_key_here
```

**Vercel Setup:**
```
Project → Settings → Environment Variables
Add: GEMINI_API_KEY = your_key
```

#### Code Dependencies
Your `lib/ai` must export:
```javascript
// lib/ai.js
export async function askGeminiWithRetry(prompt: string): Promise<string>
export function isQuotaError(e: unknown): boolean
```

#### Next.js Configuration
```javascript
// Route configuration (already handled)
export const runtime = "nodejs";  // Required for Gemini SDK
```

---

### 📊 Typical Responses

#### ✅ Success Response
```javascript
// GET /api/ai/test
{
  "ok": true,
  "reply": "System is operational. AI model responding correctly."
}

// POST /api/ai/test
{
  "ok": true,
  "reply": "Pong! Your message was received and processed."
}
```

#### ⚠️ Rate Limit Response
```javascript
{
  "ok": false,
  "error": "quota exceeded",
  "statusCode": 429,
  "details": "Gemini API rate limit reached"
}
```

#### ❌ Error Response
```javascript
{
  "ok": false,
  "error": "ai_error",
  "statusCode": 500,
  "details": "Failed to connect to Gemini API"
}
```

---

### 🧪 Test Configuration

#### Jest Setup
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'app/api/**/*.js',
    'lib/**/*.js',
    '!**/*.config.js'
  ]
}
```

#### Test Environment Setup
```javascript
// tests/setup.js
process.env.GEMINI_API_KEY = 'test-key-mock'
process.env.NODE_ENV = 'test'

// Mock fetch for testing
global.fetch = jest.fn()
```

### 🔍 Debugging Tips

#### Check Environment
```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Test connectivity
curl -s http://localhost:3000/api/ai/test
```

#### Monitor Logs
```javascript
// Add to your route for debugging
console.log('Gemini API Key present:', !!process.env.GEMINI_API_KEY)
console.log('Request method:', request.method)
console.log('AI Response received:', response?.length || 0, 'characters')
```

#### Common Issues
- **Missing API Key:** Set `GEMINI_API_KEY` in environment
- **Rate Limits:** Implement exponential backoff
- **Network Issues:** Check firewall/proxy settings
- **Timeout Errors:** Increase request timeout values

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
We use ESLint and Prettier for code formatting:
```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Fix linting errors
npm run format      # Format code with Prettier
```

---

## 📖 Documentation

- [User Guide](docs/USER_GUIDE.md) - Complete user documentation
- [API Reference](docs/API.md) - Detailed API documentation
- [Deployment Guide](docs/DEPLOYMENT.md) - Advanced deployment options
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check your DATABASE_URL in .env.local
npx prisma db pull  # Test connection
```

**Gemini API Errors**
```bash
# Verify your API key
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models
```

**Build Failures**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

---

## 🔄 Version History

### v2.1.0 (Latest)
- ✨ Added AI-powered insights dashboard
- 🚀 Improved performance with snapshot caching
- 🔧 Enhanced auto-assignment algorithms
- 🐛 Bug fixes and stability improvements

### v2.0.0
- 🎉 Major UI/UX overhaul
- 🤖 Integrated Google Gemini API
- 📊 Added advanced analytics
- 🔐 Enhanced security features

### v1.0.0
- 🚀 Initial release
- 📦 Basic CRUD operations
- 🛳️ Voyage management
- 📍 Shipment tracking

---

## 👤 Author 
[Vignesh Bolusani](https://github.com/Vigneshbolusani18)  
📧 vigneshbolusani661@gmail.com  


---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Smart Freight & Storage Planner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🙏 Acknowledgments

- [Next.js Team](https://nextjs.org/) for the incredible framework
- [Prisma Team](https://prisma.io/) for the excellent ORM
- [Neon](https://neon.tech/) for reliable serverless Postgres
- [Google](https://ai.google.dev/) for the Gemini API
- [Vercel](https://vercel.com/) for seamless deployment
- [TailwindCSS](https://tailwindcss.com/) for beautiful styling

---

## ⭐️ Support

If you found this project helpful, please consider:
- ⭐️ Starring the repository on GitHub
- 🐛 Reporting bugs and issues
- 💡 Suggesting new features
- 🤝 Contributing to the codebase
- 📢 Sharing with your network

---

---

<div align="center">
  <p><strong>Made with ❤️ for the logistics community</strong></p>
  <p>
    <a href="https://smart-freight-planner.vercel.app/">Live Demo</a> •
    <a href="mailto:vigneshbolusani@gmail.com">Report Bug</a> •
    <a href="mailto:vigneshbolusani@gmail.com">Request Feature</a>
  </p>
</div>

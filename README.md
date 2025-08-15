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
- **TailwindCSS** – Utility-first CSS framework
- **Headless UI** – Unstyled, accessible UI components
- **Heroicons** – Beautiful hand-crafted SVG icons

### Backend
- **Next.js API Routes** – Full-stack React framework
- **Prisma ORM** – Type-safe database client
- **Neon Postgres** – Serverless PostgreSQL database
- **JWT** – Secure authentication
- **Zod** – TypeScript-first schema validation

### AI & Analytics
- **Google Gemini API** – Large language model integration
- **Vercel Analytics** – Performance monitoring
- **Custom ML Models** – Predictive analytics for ETA+

### DevOps & Deployment
- **Vercel** – Deployment and hosting platform
- **GitHub Actions** – CI/CD pipeline
- **ESLint** – Code linting and formatting
- **Prettier** – Code formatting
- **TypeScript** – Type safety and developer experience

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

### Alternative Deployment Options

#### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

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

## 📚 API Documentation

### Shipments API
```javascript
// GET /api/shipments - List all shipments
// POST /api/shipments - Create new shipment
// PUT /api/shipments/[id] - Update shipment
// DELETE /api/shipments/[id] - Delete shipment
```

### Voyages API
```javascript
// GET /api/voyages - List all voyages
// POST /api/voyages - Create new voyage
// PUT /api/voyages/[id] - Update voyage
// DELETE /api/voyages/[id] - Delete voyage
```

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

### Test Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js']
}
```

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

## 👤 Author & Team

**Project Lead**  
[Your Name](https://github.com/your-username)  
📧 your.email@example.com  
🐦 [@yourtwitterhandle](https://twitter.com/yourtwitterhandle)

**Contributors**  
Thanks to all the [contributors](https://github.com/your-username/smart-freight-planner/contributors) who have helped build this project.

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

## 📞 Contact & Support

- **Documentation**: [docs.smart-freight-planner.com](https://docs.smart-freight-planner.com)
- **Issues**: [GitHub Issues](https://github.com/your-username/smart-freight-planner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/smart-freight-planner/discussions)
- **Email**: support@smart-freight-planner.com
- **Discord**: [Join our community](https://discord.gg/smart-freight-planner)

---

<div align="center">
  <p><strong>Made with ❤️ for the logistics community</strong></p>
  <p>
    <a href="https://smart-freight-planner.vercel.app/">Live Demo</a> •
    <a href="https://github.com/your-username/smart-freight-planner/issues">Report Bug</a> •
    <a href="https://github.com/your-username/smart-freight-planner/issues">Request Feature</a>
  </p>
</div>

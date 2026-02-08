#!/bin/bash
# DIP Quick Start Script
# Starts the entire DIP system: PostgreSQL, Backend, and Frontend

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "============================================"
echo "🔐 DIP - Secure Voice Communication"
echo "============================================"
echo ""

# Check if Docker is running
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker first."
  exit 1
fi

echo "1️⃣  Starting PostgreSQL..."
docker-compose up -d postgres
sleep 3
echo "✅ PostgreSQL started"
echo ""

# Backend setup
echo "2️⃣  Setting up Backend..."
cd backend

if [ ! -d "node_modules" ]; then
  echo "   Installing dependencies..."
  npm install
fi

echo "   Generating Prisma Client..."
npm run prisma:generate

echo "   Running database migrations..."
npm run prisma:migrate

echo "✅ Backend ready"
echo ""

# Start backend in background
echo "3️⃣  Starting Backend Server..."
npm run start:dev &
BACKEND_PID=$!
sleep 2
echo "✅ Backend running (PID: $BACKEND_PID)"
echo "   📍 http://localhost:3000"
echo ""

# Frontend setup
cd ../frontend

if [ ! -d "node_modules" ]; then
  echo "4️⃣  Installing frontend dependencies..."
  npm install
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo "   Creating .env.local..."
  cp .env.example .env.local
fi

echo "✅ Frontend ready"
echo ""

echo "============================================"
echo "🚀 STARTING ALL SERVICES"
echo "============================================"
echo ""
echo "📍 Frontend:  http://localhost:3000"
echo "📍 Backend:   http://localhost:3000/api/v1"
echo "📍 Database:  postgresql://postgres@localhost:5432/dip"
echo ""
echo "📝 Next Steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Register two accounts (in separate windows)"
echo "   3. Make a call between them!"
echo ""
echo "Press Ctrl+C to stop all services"
echo "============================================"
echo ""

# Start frontend
npm start

#!/bin/bash
# Simple development runner

echo "🚀 DIP Development Server"  
echo "========================="
echo ""
echo "📍 Services:"
echo "   Backend API:  http://localhost:3000/api/v1"
echo "   Frontend:     http://localhost:3000"
echo "   Database:     postgresql://postgres@localhost:5432/dip"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd /home/mq/dip/frontend
PORT=3000 npx react-scripts start

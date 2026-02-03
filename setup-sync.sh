#!/bin/bash

# Setup script for API-Football fixture sync feature

echo "🚀 Setting up API-Football Fixture Sync..."
echo ""

# Check if we're in the right directory
if [ ! -f "server/package.json" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

cd server

# Check for .env file
if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found. Creating template..."
  cat > .env << EOF
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string_here

# JWT Secret (change this!)
JWT_SECRET=change_me_to_something_secure

# API-Football Configuration
API_FOOTBALL_KEY=your_rapidapi_key_here
API_FOOTBALL_HOST=v3.football.api-sports.io

# Server Configuration
PORT=4000
NODE_ENV=development
EOF
  echo "✅ Created .env template. Please update with your credentials."
  echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo "✅ Dependencies installed"
  echo ""
fi

# Check if TypeScript types exist
if [ ! -d "node_modules/@types/node" ]; then
  echo "📦 Installing TypeScript dependencies..."
  npm install --save-dev @types/node typescript ts-node
  echo "✅ TypeScript dependencies installed"
  echo ""
fi

# Build TypeScript
echo "🔨 Building TypeScript files..."
npm run build:ts

if [ $? -eq 0 ]; then
  echo "✅ TypeScript build successful"
  echo ""
  echo "🎉 Setup complete!"
  echo ""
  echo "Next steps:"
  echo "1. Edit server/.env and add your API_FOOTBALL_KEY"
  echo "2. Start the server: cd server && npm start"
  echo "3. Navigate to http://localhost:8000/admin.html"
  echo "4. Click 'Sync Fixtures' to fetch data from API-Football"
  echo ""
else
  echo "❌ TypeScript build failed. Please check the errors above."
  exit 1
fi

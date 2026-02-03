#!/bin/bash

# Goals Goals Goals - Local Development Startup Script
# This script starts both the frontend and backend servers with configurable options

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
USE_MONGODB="false"
FRONTEND_PORT=8000
BACKEND_PORT=4000
SHOW_HELP=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mongodb)
      USE_MONGODB="true"
      shift
      ;;
    --file-storage)
      USE_MONGODB="false"
      shift
      ;;
    --frontend-port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --backend-port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    -h|--help)
      SHOW_HELP=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      SHOW_HELP=true
      shift
      ;;
  esac
done

# Show help
if [ "$SHOW_HELP" = true ]; then
  echo -e "${BLUE}Goals Goals Goals - Local Development Startup${NC}"
  echo ""
  echo "Usage: ./start.sh [options]"
  echo ""
  echo "Options:"
  echo "  --mongodb              Use MongoDB for storage (requires MONGODB_URI in server/.env)"
  echo "  --file-storage         Use file-based storage (default)"
  echo "  --frontend-port PORT   Frontend server port (default: 8000)"
  echo "  --backend-port PORT    Backend server port (default: 4000)"
  echo "  -h, --help            Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./start.sh                        # Start with file storage"
  echo "  ./start.sh --mongodb              # Start with MongoDB"
  echo "  ./start.sh --frontend-port 3000   # Use custom frontend port"
  echo ""
  exit 0
fi

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Goals Goals Goals - Local Development Startup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Check if server/.env exists
if [ ! -f "server/.env" ]; then
  echo -e "${RED}✗ server/.env not found${NC}"
  echo -e "${YELLOW}Creating server/.env from template...${NC}"
  cat > server/.env << EOF
JWT_SECRET = 'dev_secret_change_me_in_production'
# MONGODB_URI = "mongodb+srv://..."
INIT_ADMIN_PASS = 'admin123'
EOF
  echo -e "${GREEN}✓ Created server/.env${NC}"
  echo ""
fi

# Configure MongoDB
if [ "$USE_MONGODB" = "true" ]; then
  echo -e "${YELLOW}Storage: MongoDB${NC}"
  
  # Check if MONGODB_URI is commented out
  if grep -q "^# MONGODB_URI" server/.env; then
    echo -e "${YELLOW}⚠ MONGODB_URI is commented out in server/.env${NC}"
    echo -e "${YELLOW}Please uncomment MONGODB_URI in server/.env to use MongoDB${NC}"
    exit 1
  fi
  
  if ! grep -q "^MONGODB_URI" server/.env; then
    echo -e "${RED}✗ MONGODB_URI not found in server/.env${NC}"
    echo -e "${YELLOW}Please add MONGODB_URI to server/.env${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ MongoDB configuration found${NC}"
else
  echo -e "${YELLOW}Storage: File-based (users.json, leagues.json, api-calls.json)${NC}"
  echo -e "${GREEN}✓ File storage enabled${NC}"
fi

echo ""

# Check for node_modules in server
if [ ! -d "server/node_modules" ]; then
  echo -e "${YELLOW}⚠ Backend dependencies not installed${NC}"
  echo -e "${YELLOW}Installing backend dependencies...${NC}"
  (cd server && npm install)
  echo -e "${GREEN}✓ Backend dependencies installed${NC}"
  echo ""
fi

# Kill existing processes on ports
echo -e "${YELLOW}Checking for existing processes...${NC}"

if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing process on port $BACKEND_PORT...${NC}"
  lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing process on port $FRONTEND_PORT...${NC}"
  lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo -e "${GREEN}✓ Ports cleared${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Build TypeScript if needed
if [ ! -d "server/dist" ] || [ "server/src/server.ts" -nt "server/dist/server.js" ]; then
  echo -e "${YELLOW}Building TypeScript...${NC}"
  (cd server && npm run build)
  echo -e "${GREEN}✓ TypeScript built${NC}"
  echo ""
fi

# Start backend server
echo -e "${YELLOW}Starting backend server on port $BACKEND_PORT...${NC}"
PORT=$BACKEND_PORT node server/dist/server.js > logs/backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo -e "${RED}✗ Backend server failed to start${NC}"
  echo -e "${YELLOW}Check logs/backend.log for details${NC}"
  tail -20 logs/backend.log
  exit 1
fi

# Check if backend is responding
if ! curl -s http://localhost:$BACKEND_PORT/api/football/fixtures?league=39&season=2025 > /dev/null; then
  echo -e "${YELLOW}⚠ Backend started but not responding yet, waiting...${NC}"
  sleep 2
fi

echo -e "${GREEN}✓ Backend server running (PID: $BACKEND_PID)${NC}"

# Start frontend server
echo -e "${YELLOW}Starting frontend server on port $FRONTEND_PORT...${NC}"
python3 -m http.server $FRONTEND_PORT > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 1

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo -e "${RED}✗ Frontend server failed to start${NC}"
  echo -e "${YELLOW}Check logs/frontend.log for details${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}✓ Frontend server running (PID: $FRONTEND_PID)${NC}"
echo ""

# Save PIDs for cleanup
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All servers started successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "${YELLOW}Backend:${NC}   http://localhost:$BACKEND_PORT"
echo -e "${YELLOW}Storage:${NC}   $([ "$USE_MONGODB" = "true" ] && echo "MongoDB" || echo "File-based")"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Backend:  logs/backend.log"
echo -e "  Frontend: logs/frontend.log"
echo ""
echo -e "${YELLOW}To stop servers:${NC}"
echo -e "  ./stop.sh"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  tail -f logs/backend.log"
echo -e "  tail -f logs/frontend.log"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop servers and exit${NC}"

# Trap Ctrl+C to cleanup
trap "echo ''; echo -e '${YELLOW}Stopping servers...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; rm -f logs/*.pid; echo -e '${GREEN}✓ Servers stopped${NC}'; exit 0" INT

# Keep script running and tail logs
tail -f logs/backend.log logs/frontend.log

#!/bin/bash

# Goals Goals Goals - Stop Script
# Stops all running development servers

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping Goals Goals Goals servers...${NC}"
echo ""

# Try to kill using saved PIDs
if [ -f "logs/backend.pid" ]; then
  BACKEND_PID=$(cat logs/backend.pid)
  if kill -0 $BACKEND_PID 2>/dev/null; then
    kill $BACKEND_PID
    echo -e "${GREEN}✓ Backend server stopped (PID: $BACKEND_PID)${NC}"
  fi
  rm -f logs/backend.pid
fi

if [ -f "logs/frontend.pid" ]; then
  FRONTEND_PID=$(cat logs/frontend.pid)
  if kill -0 $FRONTEND_PID 2>/dev/null; then
    kill $FRONTEND_PID
    echo -e "${GREEN}✓ Frontend server stopped (PID: $FRONTEND_PID)${NC}"
  fi
  rm -f logs/frontend.pid
fi

# Fallback: kill by port
if lsof -ti:4000 > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing remaining processes on port 4000...${NC}"
  lsof -ti:4000 | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ Port 4000 cleared${NC}"
fi

if lsof -ti:8000 > /dev/null 2>&1; then
  echo -e "${YELLOW}Killing remaining processes on port 8000...${NC}"
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}✓ Port 8000 cleared${NC}"
fi

echo ""
echo -e "${GREEN}✓ All servers stopped${NC}"

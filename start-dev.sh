#!/bin/bash

# Kill any existing processes
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5051 | xargs kill -9 2>/dev/null

# Start backend
cd "/Users/missionford/cleanup-tracker-app Final/server"
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Starting backend (PID: $BACKEND_PID)..."
sleep 5

# Start frontend
cd "/Users/missionford/cleanup-tracker-app Final/client"
npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

echo "Starting frontend (PID: $FRONTEND_PID)..."
echo ""
echo "Backend running on http://localhost:5051 (PID: $BACKEND_PID)"
echo "Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Logs:"
echo "  Backend:  tail -f /tmp/backend.log"
echo "  Frontend: tail -f /tmp/frontend.log"
echo ""
echo "To stop servers: kill $BACKEND_PID $FRONTEND_PID"

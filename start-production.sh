#!/bin/bash

###############################################################################
# Production Startup Script for Cleanup Tracker Application
# This script starts the production server with proper environment configuration
###############################################################################

set -e  # Exit on error

echo "================================================"
echo "  Cleanup Tracker - Production Startup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${GREEN}→${NC} $1"
}

###############################################################################
# Pre-flight Checks
###############################################################################

echo "Running pre-flight checks..."
echo ""

# Check Node.js
if ! command_exists node; then
    print_error "Node.js is not installed"
    echo "  Install Node.js 18.x from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_warning "Node.js version is $NODE_VERSION, recommended: 18+"
else
    print_success "Node.js version: $(node -v)"
fi

# Check npm
if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm version: $(npm -v)"

# Check if production build exists
if [ ! -d "client/build" ]; then
    print_error "Client production build not found at client/build/"
    echo "  Run 'cd client && npm run build' first"
    exit 1
fi
print_success "Client production build found"

# Check server files
if [ ! -f "server/server.js" ]; then
    print_error "Server file not found at server/server.js"
    exit 1
fi
print_success "Server files found"

# Check environment file
if [ ! -f "server/.env.production" ] && [ ! -f "server/.env" ]; then
    print_warning "No environment file found (server/.env.production or server/.env)"
    print_warning "Using default environment variables"
else
    print_success "Environment file found"
fi

# Check MongoDB connection (optional check)
print_info "Checking environment configuration..."

cd server

# Source environment file if it exists
if [ -f ".env.production" ]; then
    export $(grep -v '^#' .env.production | xargs)
    print_success "Loaded .env.production"
elif [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    print_success "Loaded .env"
fi

# Validate critical environment variables
MISSING_VARS=0

if [ -z "$JWT_SECRET" ]; then
    print_error "JWT_SECRET is not set"
    MISSING_VARS=1
else
    # Check if using default/weak secret
    if [ "$JWT_SECRET" = "your-super-secret-jwt-key-change-this-in-production" ] || \
       [ "$JWT_SECRET" = "your-super-secure-jwt-secret-here" ]; then
        print_error "JWT_SECRET is using default value - INSECURE!"
        echo "  Generate a secure secret with: openssl rand -base64 32"
        MISSING_VARS=1
    else
        print_success "JWT_SECRET is configured"
    fi
fi

if [ -z "$MONGO_URI" ]; then
    print_warning "MONGO_URI is not set (will use default: mongodb://localhost:27017/cleanup-tracker)"
else
    print_success "MONGO_URI is configured"
fi

if [ "$MISSING_VARS" -eq 1 ]; then
    echo ""
    print_error "Critical environment variables are missing or insecure"
    echo ""
    echo "Create server/.env.production with:"
    echo "  NODE_ENV=production"
    echo "  JWT_SECRET=\$(openssl rand -base64 32)"
    echo "  MONGO_URI=mongodb://localhost:27017/cleanup-tracker-prod"
    echo "  FRONTEND_URL=https://yourdomain.com"
    echo ""
    exit 1
fi

# Set NODE_ENV to production
export NODE_ENV=production

print_success "All pre-flight checks passed"
echo ""

###############################################################################
# Install Dependencies
###############################################################################

echo "Checking server dependencies..."

if [ ! -d "node_modules" ]; then
    print_info "Installing server dependencies..."
    npm ci --production
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

echo ""

###############################################################################
# Start Server
###############################################################################

echo "================================================"
echo "  Starting Production Server"
echo "================================================"
echo ""

print_info "Server will start on port: ${PORT:-5051}"
print_info "Environment: ${NODE_ENV:-production}"
print_info "MongoDB: ${MONGO_URI:-mongodb://localhost:27017/cleanup-tracker}"
echo ""

# Check if PM2 is available
if command_exists pm2; then
    print_info "PM2 detected - starting with PM2..."

    # Stop existing instance if running
    pm2 stop cleanup-tracker 2>/dev/null || true
    pm2 delete cleanup-tracker 2>/dev/null || true

    # Start with PM2
    pm2 start server.js \
        --name "cleanup-tracker" \
        --env production \
        -i max \
        --watch false \
        --max-memory-restart 500M

    # Save PM2 configuration
    pm2 save

    print_success "Server started with PM2"
    echo ""
    echo "Useful PM2 commands:"
    echo "  pm2 logs cleanup-tracker  - View logs"
    echo "  pm2 monit                 - Monitor performance"
    echo "  pm2 restart cleanup-tracker - Restart server"
    echo "  pm2 stop cleanup-tracker  - Stop server"
    echo ""

    # Show logs for a few seconds
    print_info "Showing startup logs (Ctrl+C to exit)..."
    sleep 2
    pm2 logs cleanup-tracker --lines 20
else
    print_warning "PM2 not installed - starting with node"
    print_info "Install PM2 for better process management: npm install -g pm2"
    echo ""

    # Start with node
    node server.js
fi

#!/bin/bash

###############################################################################
# Environment Verification Script for Cleanup Tracker
# Validates all environment variables and configurations before deployment
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/server"

echo "================================================"
echo "  Environment Verification"
echo "  Cleanup Tracker Application"
echo "================================================"
echo ""

# Load environment
if [ -f ".env.production" ]; then
    echo -e "${GREEN}→${NC} Loading .env.production"
    set -a
    source .env.production
    set +a
elif [ -f ".env" ]; then
    echo -e "${YELLOW}!${NC} Using .env (no .env.production found)"
    set -a
    source .env
    set +a
else
    echo -e "${RED}✗${NC} No environment file found!"
    echo "  Create server/.env.production or server/.env"
    exit 1
fi

echo ""

# Check function
check_var() {
    local var_name=$1
    local var_value=$2
    local required=$3
    local description=$4

    CHECKS=$((CHECKS + 1))

    if [ -z "$var_value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $var_name - MISSING (required)"
            echo "   $description"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}!${NC} $var_name - not set (optional)"
            echo "   $description"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${GREEN}✓${NC} $var_name - configured"
        # Show masked value for sensitive vars
        if [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"PASSWORD"* ]]; then
            echo "   Value: ********"
        else
            echo "   Value: $var_value"
        fi
    fi
}

# Check secure function
check_secure_var() {
    local var_name=$1
    local var_value=$2
    local insecure_values=$3

    CHECKS=$((CHECKS + 1))

    if [ -z "$var_value" ]; then
        echo -e "${RED}✗${NC} $var_name - MISSING (required)"
        ERRORS=$((ERRORS + 1))
        return
    fi

    # Check against insecure values
    IFS='|' read -ra INSECURE <<< "$insecure_values"
    for insecure in "${INSECURE[@]}"; do
        if [ "$var_value" = "$insecure" ]; then
            echo -e "${RED}✗${NC} $var_name - INSECURE (using default/weak value)"
            echo "   Current: ********"
            echo "   This is a known default value and must be changed!"
            ERRORS=$((ERRORS + 1))
            return
        fi
    done

    # Check length for secrets
    if [ ${#var_value} -lt 32 ]; then
        echo -e "${YELLOW}!${NC} $var_name - configured but short (${#var_value} chars)"
        echo "   Recommended: 32+ characters for production"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} $var_name - secure (${#var_value} chars)"
    fi
}

echo "================================================"
echo "  Required Configuration"
echo "================================================"
echo ""

# Check NODE_ENV
check_var "NODE_ENV" "$NODE_ENV" "true" \
    "Must be 'production' for production deployment"

if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}!${NC} NODE_ENV is not 'production' (current: $NODE_ENV)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Check JWT_SECRET
check_secure_var "JWT_SECRET" "$JWT_SECRET" \
    "your-super-secret-jwt-key-change-this-in-production|your-super-secure-jwt-secret-here|secret|test"

echo ""

# Check MONGO_URI
check_var "MONGO_URI" "$MONGO_URI" "true" \
    "MongoDB connection string (mongodb:// or mongodb+srv://)"

if [ -n "$MONGO_URI" ]; then
    # Validate format
    if [[ ! "$MONGO_URI" =~ ^mongodb(\+srv)?:// ]]; then
        echo -e "${RED}✗${NC} MONGO_URI - Invalid format"
        echo "   Must start with mongodb:// or mongodb+srv://"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for localhost in production
    if [ "$NODE_ENV" = "production" ] && [[ "$MONGO_URI" == *"localhost"* ]]; then
        echo -e "${YELLOW}!${NC} MONGO_URI - Using localhost in production"
        echo "   Consider using MongoDB Atlas or a remote database"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# Check PORT
check_var "PORT" "$PORT" "false" \
    "Server port (default: 5051, may be overridden by hosting platform)"

echo ""

echo "================================================"
echo "  Security Configuration"
echo "================================================"
echo ""

# Check FRONTEND_URL
check_var "FRONTEND_URL" "$FRONTEND_URL" "true" \
    "Allowed frontend origins for CORS (comma-separated)"

if [ -n "$FRONTEND_URL" ]; then
    # Check for localhost in production
    if [ "$NODE_ENV" = "production" ] && [[ "$FRONTEND_URL" == *"localhost"* ]]; then
        echo -e "${YELLOW}!${NC} FRONTEND_URL - Contains localhost in production"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check for placeholder
    if [[ "$FRONTEND_URL" == *"yourdomain.com"* ]] || [[ "$FRONTEND_URL" == *"example.com"* ]]; then
        echo -e "${RED}✗${NC} FRONTEND_URL - Using placeholder domain"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

# Check rate limiting
check_var "RATE_LIMIT_MAX" "$RATE_LIMIT_MAX" "false" \
    "General rate limit (requests per 15 min, default: 100)"

check_var "AUTH_RATE_LIMIT_MAX" "$AUTH_RATE_LIMIT_MAX" "false" \
    "Auth rate limit (requests per 15 min, default: 5)"

echo ""

echo "================================================"
echo "  Optional Configuration"
echo "================================================"
echo ""

# Check optional vars
check_var "INVENTORY_CSV_URL" "$INVENTORY_CSV_URL" "false" \
    "Google Sheets CSV URL for inventory import"

check_var "UPLOAD_LIMIT" "$UPLOAD_LIMIT" "false" \
    "Max upload size (default: 10mb)"

check_var "LOG_LEVEL" "$LOG_LEVEL" "false" \
    "Logging level: error, warn, info, debug (default: info)"

echo ""

echo "================================================"
echo "  File System Checks"
echo "================================================"
echo ""

cd "$SCRIPT_DIR"

# Check production build
if [ -d "client/build" ]; then
    BUILD_SIZE=$(du -sh client/build | cut -f1)
    echo -e "${GREEN}✓${NC} Client production build exists (size: $BUILD_SIZE)"

    # Check for index.html
    if [ -f "client/build/index.html" ]; then
        echo -e "${GREEN}✓${NC} client/build/index.html found"
    else
        echo -e "${RED}✗${NC} client/build/index.html missing"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Client production build not found"
    echo "   Run: cd client && npm run build"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check server files
if [ -f "server/server.js" ]; then
    echo -e "${GREEN}✓${NC} server/server.js found"
else
    echo -e "${RED}✗${NC} server/server.js missing"
    ERRORS=$((ERRORS + 1))
fi

# Check server dependencies
if [ -d "server/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Server dependencies installed"
else
    echo -e "${YELLOW}!${NC} Server dependencies not installed"
    echo "   Run: cd server && npm ci --production"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

echo "================================================"
echo "  Security Audit"
echo "================================================"
echo ""

cd "$SCRIPT_DIR/server"

# Run npm audit (don't fail on this)
echo "Running npm audit..."
if npm audit --production --audit-level=high 2>&1 | grep -q "found 0"; then
    echo -e "${GREEN}✓${NC} No high/critical vulnerabilities found"
else
    echo -e "${YELLOW}!${NC} Vulnerabilities detected"
    echo "   Run: npm audit"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

echo "================================================"
echo "  Summary"
echo "================================================"
echo ""

echo "Total checks performed: $CHECKS"
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed! Ready for production deployment.${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Review this report"
        echo "  2. Run: ./start-production.sh"
        echo "  3. Test health endpoint: curl http://localhost:5051/api/health"
        exit 0
    else
        echo -e "${YELLOW}! All critical checks passed, but there are warnings.${NC}"
        echo "Review the warnings above before deploying."
        echo ""
        echo "To proceed anyway:"
        echo "  ./start-production.sh"
        exit 0
    fi
else
    echo -e "${RED}✗ Configuration errors detected. Fix them before deployment.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  1. Generate JWT secret: openssl rand -base64 32"
    echo "  2. Update server/.env.production with production values"
    echo "  3. Build client: cd client && npm run build"
    echo "  4. Set FRONTEND_URL to your actual domain"
    exit 1
fi

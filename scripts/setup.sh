#!/bin/bash

# ===========================================
# My-SaaS Setup Script
# ===========================================
# This script initializes the development environment
# by creating necessary .env files and installing dependencies.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       My-SaaS Development Setup        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to create env file from example
create_env_file() {
    local example_file="$1"
    local target_file="$2"
    local app_name="$3"

    if [ -f "$target_file" ]; then
        echo -e "${YELLOW}⚠${NC}  $app_name: $target_file already exists, skipping..."
    elif [ -f "$example_file" ]; then
        cp "$example_file" "$target_file"
        echo -e "${GREEN}✓${NC}  $app_name: Created $target_file"
    else
        echo -e "${RED}✗${NC}  $app_name: Example file not found: $example_file"
        return 1
    fi
}

# Step 1: Create wiki structure (for Claude Code knowledge management)
echo -e "${BLUE}[1/4]${NC} Setting up wiki structure..."
echo ""

mkdir -p "$PROJECT_ROOT/wiki/conceitos" "$PROJECT_ROOT/wiki/decisoes" "$PROJECT_ROOT/wiki/arquitetura"
mkdir -p "$PROJECT_ROOT/raw/meetings" "$PROJECT_ROOT/raw/decisions"

if [ -f "$PROJECT_ROOT/wiki/index.md" ]; then
    echo -e "${GREEN}✓${NC}  Wiki structure already exists"
else
    echo -e "${GREEN}✓${NC}  Wiki structure created"
fi

echo ""

# Step 2: Create environment files
echo -e "${BLUE}[2/4]${NC} Setting up environment files..."
echo ""

# API environment
create_env_file \
    "$PROJECT_ROOT/apps/api/.env.example" \
    "$PROJECT_ROOT/apps/api/.env" \
    "API"

# Web environment
create_env_file \
    "$PROJECT_ROOT/apps/web/.env.local.example" \
    "$PROJECT_ROOT/apps/web/.env.local" \
    "Web"

echo ""

# Step 3: Install dependencies
echo -e "${BLUE}[3/4]${NC} Installing dependencies..."
echo ""

cd "$PROJECT_ROOT"
npm install

echo ""

# Step 4: Verify setup
echo -e "${BLUE}[4/4]${NC} Verifying setup..."
echo ""

ERRORS=0

# Check API .env
if [ -f "$PROJECT_ROOT/apps/api/.env" ]; then
    echo -e "${GREEN}✓${NC}  API .env exists"
else
    echo -e "${RED}✗${NC}  API .env missing"
    ERRORS=$((ERRORS + 1))
fi

# Check Web .env.local
if [ -f "$PROJECT_ROOT/apps/web/.env.local" ]; then
    echo -e "${GREEN}✓${NC}  Web .env.local exists"
else
    echo -e "${RED}✗${NC}  Web .env.local missing"
    ERRORS=$((ERRORS + 1))
fi

# Check node_modules
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${GREEN}✓${NC}  Dependencies installed"
else
    echo -e "${RED}✗${NC}  Dependencies not installed"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Final message
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Setup completed!               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Next steps:"
    echo ""
    echo -e "  ${BLUE}1.${NC} Start infrastructure (PostgreSQL + Redis):"
    echo -e "     ${YELLOW}npm run docker:up${NC}"
    echo ""
    echo -e "  ${BLUE}2.${NC} Run database migrations:"
    echo -e "     ${YELLOW}npm run db:migrate${NC}"
    echo ""
    echo -e "  ${BLUE}3.${NC} Start development servers:"
    echo -e "     ${YELLOW}npm run dev${NC}"
    echo ""
    echo -e "  ${BLUE}URLs:${NC}"
    echo -e "     API:     http://localhost:3000/api"
    echo -e "     Web:     http://localhost:3001"
    echo -e "     Swagger: http://localhost:3000/api/docs"
    echo ""
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║    Setup completed with errors         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Please review the errors above and fix them manually."
    exit 1
fi

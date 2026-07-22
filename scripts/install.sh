#!/usr/bin/env bash

# CleanCheck v1.0.0 — Automated Linux/Unix Installer Script
# Copyright © 2026 CleanCheck Software Solutions, LLC. All rights reserved.

set -e

# Visual formatting helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================"
echo -e "       CleanCheck v1.0.0 Production Installer"
echo -e "======================================================${NC}"
echo "Deploying to: $(hostname)"
echo "Current Time: $(date)"

# Step 1: System requirements checks
echo -e "\n${BLUE}[1/5] Verifying System Prerequisites...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js is not installed. Node.js v18+ is required.${NC}"
    exit 1
else
    NODE_VER=$(node -v)
    echo -e "${GREEN}✓ Node.js detected: $NODE_VER${NC}"
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}Error: npm is not installed. npm is required for package installations.${NC}"
    exit 1
else
    NPM_VER=$(npm -v)
    echo -e "${GREEN}✓ npm detected: $NPM_VER${NC}"
fi

# Step 2: Environment Configuration setup
echo -e "\n${BLUE}[2/5] Checking Configuration Setup...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Bootstrapping template from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created default .env file.${NC}"
    echo -e "${YELLOW}Please open .env and update your GEMINI_API_KEY and APP_URL after installation.${NC}"
else
    echo -e "${GREEN}✓ Production .env file detected.${NC}"
fi

# Step 3: Install Production Dependencies
echo -e "\n${BLUE}[3/5] Installing Dependencies...${NC}"
npm ci --only=production
echo -e "${GREEN}✓ Clean dependency tree established successfully.${NC}"

# Step 4: Build Application Artifacts
echo -e "\n${BLUE}[4/5] Building Client & Server Bundles...${NC}"
npm run build
echo -e "${GREEN}✓ Production build generated inside /dist.${NC}"

# Step 5: Wrap Setup
echo -e "\n${BLUE}[5/5] Finalizing Installation...${NC}"
echo -e "${GREEN}======================================================"
echo -e "       CleanCheck Installation Succeeded!"
echo -e "======================================================${NC}"
echo -e "To start the application in the background (Daemon mode):"
echo -e "  ${YELLOW}nohup npm start > app.log 2>&1 &${NC}"
echo ""
echo -e "To start the application via Docker Compose (Recommended):"
echo -e "  ${YELLOW}docker-compose up -d --build${NC}"
echo "======================================================"

#!/usr/bin/env bash

# CleanCheck v1.0.0 — Automated Backup Utility
# Copyright © 2026 CleanCheck Software Solutions, LLC. All rights reserved.

set -e

# Visual formatting helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="cleancheck_backup_${TIMESTAMP}.tar.gz"

echo -e "${BLUE}======================================================"
echo -e "       CleanCheck v1.0.0 Backup Controller"
echo -e "======================================================${NC}"
echo "Current Time: $(date)"

# Ensure backup destination directory exists
mkdir -p "$BACKUP_DIR"

echo -e "\n${BLUE}[1/3] Archiving Configuration & Settings...${NC}"
# Temporary staging directory
STAGING="staging_${TIMESTAMP}"
mkdir -p "$STAGING"

# Copy essential runtime files
[ -f .env ] && cp .env "$STAGING/.env"
[ -f firebase-applet-config.json ] && cp firebase-applet-config.json "$STAGING/"

# Live MongoDB Database Backup (if configured and mongodump is available)
if [ -f .env ]; then
    MONGO_URI=$(grep -E "^MONGODB_URI=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi
if [ -z "$MONGO_URI" ] && [ -n "$MONGODB_URI" ]; then
    MONGO_URI="$MONGODB_URI"
fi

if [ -n "$MONGO_URI" ]; then
    if command -v mongodump >/dev/null 2>&1; then
        echo -e "${BLUE}[MongoDB] Performing live database backup snapshot...${NC}"
        mongodump --uri="$MONGO_URI" --out="$STAGING/mongodb_dump" --quiet
        echo -e "${GREEN}✓ MongoDB backup complete.${NC}"
    else
        echo -e "${YELLOW}WARNING: MONGODB_URI is configured but 'mongodump' command is not available. Skipping database dump.${NC}"
    fi
fi

# Archive logos/branding assets
if [ -d assets ]; then
    cp -r assets "$STAGING/"
fi

echo -e "${GREEN}✓ Local staging populated.${NC}"

echo -e "\n${BLUE}[2/3] Compressing Backup Snapshot Archive...${NC}"
tar -czf "${BACKUP_DIR}/${ARCHIVE_NAME}" -C "$STAGING" .
rm -rf "$STAGING"

echo -e "${GREEN}✓ Archive created: ${BACKUP_DIR}/${ARCHIVE_NAME}${NC}"

echo -e "\n${BLUE}[3/3] Backup Status Overview...${NC}"
echo -e "${GREEN}======================================================"
echo -e "       Backup Completed Successfully!"
echo -e "======================================================${NC}"
echo -e "Backup Location:  ${GREEN}${BACKUP_DIR}/${ARCHIVE_NAME}${NC}"
echo -e "Backup Size:      $(du -sh "${BACKUP_DIR}/${ARCHIVE_NAME}" | cut -f1)"
echo -e "Operational Status: ${GREEN}Online - Ready${NC}"
echo "======================================================"

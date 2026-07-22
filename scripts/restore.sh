#!/usr/bin/env bash

# CleanCheck v1.0.0 — Automated Restore Utility
# Copyright © 2026 CleanCheck Software Solutions, LLC. All rights reserved.

set -e

# Visual formatting helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================"
echo -e "       CleanCheck v1.0.0 Restore Controller"
echo -e "======================================================${NC}"

# Verify if target backup is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup archive file specified.${NC}"
    echo -e "Usage: $0 backups/cleancheck_backup_YYYYMMDD_HHMMSS.tar.gz"
    echo -e "\nAvailable backups:"
    if [ -d backups ] && [ "$(ls -A backups)" ]; then
        ls -1 backups/*.tar.gz
    else
        echo -e "  ${YELLOW}(No backup files found)${NC}"
    fi
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This operation will overwrite your active .env and assets files!${NC}"
read -p "Are you absolutely sure you want to proceed? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Restoration aborted by operator.${NC}"
    exit 1
fi

echo -e "\n${BLUE}[1/2] Extracting Backup Snapshot Archive...${NC}"
TEMP_EXTRACT="temp_restore_$(date +%s)"
mkdir -p "$TEMP_EXTRACT"
tar -xzf "$BACKUP_FILE" -C "$TEMP_EXTRACT"

echo -e "${GREEN}✓ Snapshot extraction complete.${NC}"

echo -e "\n${BLUE}[2/2] Restoring Operational Configurations...${NC}"

# Restore configuration files
[ -f "$TEMP_EXTRACT/.env" ] && cp "$TEMP_EXTRACT/.env" .env && echo "Restored .env"
[ -f "$TEMP_EXTRACT/firebase-applet-config.json" ] && cp "$TEMP_EXTRACT/firebase-applet-config.json" firebase-applet-config.json && echo "Restored firebase-applet-config.json"

# Restore asset directories
if [ -d "$TEMP_EXTRACT/assets" ]; then
    rm -rf assets
    cp -r "$TEMP_EXTRACT/assets" assets
    echo "Restored assets directory"
fi

# Live MongoDB Database Restore (if backup folder exists and mongorestore is available)
if [ -d "$TEMP_EXTRACT/mongodb_dump" ]; then
    if [ -f .env ]; then
        MONGO_URI=$(grep -E "^MONGODB_URI=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
    if [ -z "$MONGO_URI" ] && [ -n "$MONGODB_URI" ]; then
        MONGO_URI="$MONGODB_URI"
    fi
    if [ -n "$MONGO_URI" ]; then
        if command -v mongorestore >/dev/null 2>&1; then
            echo -e "${BLUE}[MongoDB] Restoring live database snapshot from backup...${NC}"
            mongorestore --uri="$MONGO_URI" "$TEMP_EXTRACT/mongodb_dump" --drop --quiet
            echo -e "${GREEN}✓ MongoDB restore complete.${NC}"
        else
            echo -e "${YELLOW}WARNING: Database snapshot found in backup but 'mongorestore' command is not available. Skipping database restore.${NC}"
        fi
    fi
fi

# Cleanup
rm -rf "$TEMP_EXTRACT"

echo -e "${GREEN}======================================================"
echo -e "       Restoration Completed Successfully!"
echo -e "======================================================${NC}"
echo "Restart the application server container to apply changes."
echo "======================================================"

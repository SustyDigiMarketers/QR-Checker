#!/usr/bin/env bash

# CleanCheck v1.0.0 — Native MongoDB Backup & Restore Script
# Copyright © 2026 CleanCheck Software Solutions, LLC. All rights reserved.

set -e

# Visual formatting helpers
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================"
2: echo -e "       CleanCheck MongoDB Backup & Restore Engine"
3: echo -e "======================================================${NC}"

# 1. Load MONGODB_URI from environment
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}Error: MONGODB_URI is not set in your .env file.${NC}"
    exit 1
fi

ACTION=$1
if [ "$ACTION" != "backup" ] && [ "$ACTION" != "restore" ]; then
    echo -e "${YELLOW}Usage: $0 [backup|restore] [backup_directory_path]${NC}"
    echo -e "Examples:"
    echo -e "  $0 backup ./mongo_snapshots"
    echo -e "  $0 restore ./mongo_snapshots/cleancheck"
    exit 1
fi

# Check for mongodump and mongorestore binaries
if ! command -v mongodump &> /dev/null; then
    echo -e "${YELLOW}Warning: mongodump command not found. Please install mongodb-database-tools.${NC}"
fi

TARGET_DIR=${2:-"./mongo_snapshots"}

if [ "$ACTION" == "backup" ]; then
    echo -e "${BLUE}[1/2] Executing MongoDB Dump snapshot...${NC}"
    mkdir -p "$TARGET_DIR"
    
    if mongodump --uri="$MONGODB_URI" --out="$TARGET_DIR"; then
        echo -e "${GREEN}✓ MongoDB backup dump created successfully at $TARGET_DIR${NC}"
    else
        echo -e "${RED}Error: mongodump failed. Ensure your connection string and credentials are correct.${NC}"
        exit 1
    fi
else
    # Restore action
    if [ -z "$2" ]; then
        echo -e "${RED}Error: Please specify the path to the backup dump directory to restore from.${NC}"
        echo -e "Example: $0 restore ./mongo_snapshots/cleancheck"
        exit 1
    fi
    
    if [ ! -d "$2" ]; then
        echo -e "${RED}Error: Backup dump directory does not exist: $2${NC}"
        exit 1
    fi

    echo -e "${YELLOW}WARNING: This operation will overwrite and restore all collections in the remote MongoDB instance!${NC}"
    read -p "Are you absolutely sure you want to proceed? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Restoration aborted by operator.${NC}"
        exit 1
    fi

    echo -e "${BLUE}[1/2] Executing MongoDB Restore from dump...${NC}"
    if mongorestore --uri="$MONGODB_URI" --drop "$2"; then
        echo -e "${GREEN}✓ MongoDB database successfully restored from snapshot: $2${NC}"
    else
        echo -e "${RED}Error: mongorestore failed.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}======================================================"
echo -e "                 Operation Complete!"
echo -e "======================================================${NC}"

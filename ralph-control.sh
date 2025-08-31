#!/bin/bash

# Ralph Control - Send commands to the running Ralph loop

COMMAND_FILE="ralph-commands.txt"
STATUS_FILE="ralph-status.json"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

case "$1" in
    pause)
        echo "pause" >> "$COMMAND_FILE"
        echo -e "${YELLOW}Pausing Ralph loop...${NC}"
        ;;
    resume)
        echo "resume" >> "$COMMAND_FILE"
        echo -e "${GREEN}Resuming Ralph loop...${NC}"
        ;;
    skip)
        echo "skip" >> "$COMMAND_FILE"
        echo -e "${YELLOW}Skipping current task...${NC}"
        ;;
    stop)
        echo "stop" >> "$COMMAND_FILE"
        echo -e "${YELLOW}Stopping Ralph loop gracefully...${NC}"
        ;;
    status)
        if [ -f "$STATUS_FILE" ]; then
            echo -e "${CYAN}Ralph Loop Status:${NC}"
            jq '.' "$STATUS_FILE"
        else
            echo "No status file found. Is Ralph running?"
        fi
        ;;
    watch)
        # Live monitoring
        watch -n 2 -c "jq '.' $STATUS_FILE 2>/dev/null || echo 'Waiting for Ralph...'"
        ;;
    tail)
        # Follow the interactive log
        tail -f ralph-interactive.log
        ;;
    *)
        echo -e "${CYAN}Ralph Control Commands:${NC}"
        echo "  ./ralph-control.sh pause    - Pause after current iteration"
        echo "  ./ralph-control.sh resume   - Resume paused loop"
        echo "  ./ralph-control.sh skip     - Skip current task"
        echo "  ./ralph-control.sh stop     - Stop gracefully"
        echo "  ./ralph-control.sh status   - Show current status"
        echo "  ./ralph-control.sh watch    - Live status monitoring"
        echo "  ./ralph-control.sh tail     - Follow log output"
        ;;
esac
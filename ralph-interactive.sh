#!/bin/bash

# Ralph Interactive Loop - Enhanced with user interaction capabilities
# This version allows real-time monitoring and control

LOOP_COUNT=0
MAX_ITERATIONS=${1:-100}
LOG_FILE="ralph-interactive.log"
STATUS_FILE="ralph-status.json"
COMMAND_FILE="ralph-commands.txt"
OUTPUT_DIR="ralph-output"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create output directory for iteration results
mkdir -p "$OUTPUT_DIR"

# Initialize command file
touch "$COMMAND_FILE"

# Function to update status
update_status() {
    local status="$1"
    local message="$2"
    echo "{
  \"iteration\": $LOOP_COUNT,
  \"status\": \"$status\",
  \"message\": \"$message\",
  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"completed_tasks\": $(grep -c "^\- \[x\]" TODO.md 2>/dev/null || echo 0),
  \"pending_tasks\": $(grep -c "^\- \[ \]" TODO.md 2>/dev/null || echo 0),
  \"current_task\": \"$(grep "^\- \[ \]" TODO.md 2>/dev/null | head -1 | sed 's/- \[ \] //')\"
}" > "$STATUS_FILE"
}

# Function to display live status
show_status() {
    clear
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}        🤖 RALPH INTERACTIVE LOOP - LIVE STATUS 🤖${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    
    if [ -f "$STATUS_FILE" ]; then
        local iteration=$(jq -r '.iteration' "$STATUS_FILE")
        local status=$(jq -r '.status' "$STATUS_FILE")
        local message=$(jq -r '.message' "$STATUS_FILE")
        local completed=$(jq -r '.completed_tasks' "$STATUS_FILE")
        local pending=$(jq -r '.pending_tasks' "$STATUS_FILE")
        local current=$(jq -r '.current_task' "$STATUS_FILE")
        
        echo -e "${YELLOW}Iteration:${NC} $iteration / $MAX_ITERATIONS"
        echo -e "${YELLOW}Status:${NC} $status"
        echo -e "${YELLOW}Message:${NC} $message"
        echo -e "${GREEN}Completed Tasks:${NC} $completed"
        echo -e "${RED}Pending Tasks:${NC} $pending"
        echo -e "${BLUE}Current Task:${NC} $current"
    fi
    
    echo -e "${PURPLE}───────────────────────────────────────────────────────────────${NC}"
    echo -e "${CYAN}Commands:${NC}"
    echo "  ${GREEN}pause${NC}    - Pause after current iteration"
    echo "  ${GREEN}resume${NC}   - Resume paused loop"
    echo "  ${GREEN}skip${NC}     - Skip current task"
    echo "  ${GREEN}focus${NC}    - Focus on specific task"
    echo "  ${GREEN}status${NC}   - Show this status"
    echo "  ${GREEN}stop${NC}     - Stop the loop gracefully"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
}

# Function to check for commands
check_commands() {
    if [ -f "$COMMAND_FILE" ] && [ -s "$COMMAND_FILE" ]; then
        local cmd=$(tail -1 "$COMMAND_FILE")
        case "$cmd" in
            "pause")
                echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Loop paused by user${NC}" | tee -a "$LOG_FILE"
                update_status "paused" "Loop paused by user request"
                while [ "$(tail -1 "$COMMAND_FILE")" == "pause" ]; do
                    sleep 2
                done
                ;;
            "skip")
                echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Skipping current task${NC}" | tee -a "$LOG_FILE"
                return 1
                ;;
            "stop")
                echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] Loop stopped by user${NC}" | tee -a "$LOG_FILE"
                update_status "stopped" "Loop stopped by user request"
                exit 0
                ;;
        esac
    fi
    return 0
}

# Function to send notification
notify() {
    local message="$1"
    echo -e "${GREEN}[NOTIFICATION] $message${NC}"
    # Add system notification if available
    if command -v notify-send &> /dev/null; then
        notify-send "Ralph Loop" "$message"
    fi
}

# Main loop
echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] Ralph Interactive Loop started${NC}" | tee "$LOG_FILE"
update_status "running" "Ralph loop initialized"
show_status

while [ $LOOP_COUNT -lt $MAX_ITERATIONS ]; do
    LOOP_COUNT=$((LOOP_COUNT + 1))
    
    # Check for user commands
    check_commands
    
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Starting iteration $LOOP_COUNT${NC}" | tee -a "$LOG_FILE"
    update_status "running" "Iteration $LOOP_COUNT in progress"
    
    # Count remaining tasks
    TASK_COUNT=$(grep -c "^\- \[ \]" TODO.md 2>/dev/null || echo 0)
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Found $TASK_COUNT tasks in TODO${NC}" | tee -a "$LOG_FILE"
    
    if [ $TASK_COUNT -eq 0 ]; then
        echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] All tasks completed!${NC}" | tee -a "$LOG_FILE"
        notify "All PlayClone tasks completed! 🎉"
        update_status "completed" "All tasks finished successfully"
        break
    fi
    
    # Save iteration output
    ITERATION_OUTPUT="$OUTPUT_DIR/iteration-$LOOP_COUNT.log"
    
    # Run Claude with the prompt, save output, and display progress
    {
        echo "═══ ITERATION $LOOP_COUNT START ═══"
        claude --dangerously-skip-permissions << 'EOF' 2>&1 | tee -a "$ITERATION_OUTPUT"
Read PROMPT.md to understand the project.
Read TODO.md to see what needs to be done.
Pick the next uncompleted task from TODO.md and implement it completely.
Test your implementation.
Update TODO.md to mark the task as completed.
If you encounter any issues, document them in FIX_PLAN.md.
Show a brief summary of what you accomplished.
EOF
        echo "═══ ITERATION $LOOP_COUNT END ═══"
    } | while IFS= read -r line; do
        # Extract and display key information
        if [[ "$line" == *"Implementing"* ]] || [[ "$line" == *"Creating"* ]] || [[ "$line" == *"Testing"* ]]; then
            echo -e "${CYAN}► $line${NC}"
            update_status "running" "$line"
        fi
    done
    
    # Check if iteration succeeded
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] Iteration $LOOP_COUNT completed successfully${NC}" | tee -a "$LOG_FILE"
        notify "Iteration $LOOP_COUNT completed ✓"
        
        # Show brief summary every 5 iterations
        if [ $((LOOP_COUNT % 5)) -eq 0 ]; then
            show_status
            sleep 2
        fi
    else
        echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] Iteration $LOOP_COUNT failed${NC}" | tee -a "$LOG_FILE"
        notify "Iteration $LOOP_COUNT failed ✗"
        update_status "error" "Iteration $LOOP_COUNT encountered an error"
        
        # Auto-retry with backoff
        echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] Waiting 30 seconds before retry...${NC}" | tee -a "$LOG_FILE"
        sleep 30
    fi
    
    # Brief pause between iterations
    sleep 5
done

echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')] Ralph loop completed after $LOOP_COUNT iterations${NC}" | tee -a "$LOG_FILE"
update_status "finished" "Loop completed after $LOOP_COUNT iterations"
notify "Ralph loop finished! Total iterations: $LOOP_COUNT"
show_status
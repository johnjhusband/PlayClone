#!/bin/bash
# Ralph Loop - Automated Development with Claude
# Implements continuous development loop for PlayClone

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
MAX_ITERATIONS=100
SLEEP_BETWEEN_LOOPS=5
LOG_FILE="ralph.log"
CHECKPOINT_DIR="checkpoints"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Handle Ctrl+C properly
trap 'echo -e "\n${RED}Ralph loop interrupted by user${NC}"; exit 1' INT TERM

# Create checkpoint directory
mkdir -p "$CHECKPOINT_DIR"

# Function to create git checkpoint
create_checkpoint() {
    local iteration=$1
    echo -e "${GREEN}Creating checkpoint for iteration $iteration${NC}"
    
    # Initialize git if needed
    if [ ! -d .git ]; then
        git init
        git add .
        git commit -m "Initial Ralph checkpoint"
    fi
    
    # Create checkpoint
    git add -A
    git commit -m "Ralph iteration $iteration - $(date '+%Y-%m-%d %H:%M:%S')" || true
}

# Function to log output
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if TODO is empty or complete
check_todo_status() {
    if [ -f TODO.md ]; then
        # Count unchecked items (lines starting with "- [ ]")
        local unchecked=$(grep -c "^- \[ \]" TODO.md 2>/dev/null || echo "0")
        return $unchecked
    else
        return 0
    fi
}

# Function to run Claude with the prompt
run_claude_iteration() {
    local iteration=$1
    log_message "Starting iteration $iteration"
    
    # Check if TODO has items
    check_todo_status
    local todo_count=$?
    
    if [ $todo_count -eq 0 ]; then
        log_message "TODO is empty or complete, requesting new tasks..."
        echo -e "${YELLOW}Generating new TODO items...${NC}"
        
        # Ask Claude to generate new TODO items
        echo "Generating new TODO items..."
        cat << 'EOF' | claude --dangerously-skip-permissions
Read PROMPT.md, TODO.md, and FIX_PLAN.md.
The TODO list is empty or complete. 
Based on the project progress, generate the next set of TODO items.
Update TODO.md with new tasks that need to be done.
Focus on the next logical phase of development.
EOF
    else
        log_message "Found $todo_count tasks in TODO"
        
        # Run main development iteration
        echo "Running Claude with task..."
        cat << 'EOF' | claude --dangerously-skip-permissions
Read PROMPT.md to understand the project.
Read TODO.md to see what needs to be done.
Read FIX_PLAN.md to check for any issues that need fixing.

Pick the next uncompleted task from TODO.md and implement it completely:
1. Create any necessary files
2. Write the full implementation
3. Add error handling
4. Update TODO.md to mark the task as complete
5. If you encounter any issues, document them in FIX_PLAN.md
6. If you discover new tasks, add them to TODO.md

Focus on completing one task thoroughly before moving on.
Write actual, working code - not placeholders or comments about what should be done.
Test your implementation if possible.

Current working directory: /home/john/repos/PlayClone/
EOF
    fi
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "Iteration $iteration completed successfully"
        echo -e "${GREEN}✓ Iteration $iteration complete${NC}"
        
        # Create checkpoint after successful iteration
        create_checkpoint $iteration
        
        return 0
    else
        log_message "Iteration $iteration failed with exit code $exit_code"
        echo -e "${RED}✗ Iteration $iteration failed${NC}"
        
        # Document the failure
        echo "" >> FIX_PLAN.md
        echo "### Issue: Ralph iteration $iteration failed" >> FIX_PLAN.md
        echo "**Date**: $(date '+%Y-%m-%d %H:%M')" >> FIX_PLAN.md
        echo "**Severity**: High" >> FIX_PLAN.md
        echo "**Component**: Ralph Loop" >> FIX_PLAN.md
        echo "**Description**: Iteration failed with exit code $exit_code" >> FIX_PLAN.md
        echo "**Status**: Open" >> FIX_PLAN.md
        
        return 1
    fi
}

# Main loop
main() {
    echo -e "${GREEN}=== Starting Ralph Loop for PlayClone ===${NC}"
    log_message "Ralph loop started"
    
    local iteration=1
    local consecutive_failures=0
    
    while [ $iteration -le $MAX_ITERATIONS ]; do
        echo ""
        echo -e "${YELLOW}=== Iteration $iteration of $MAX_ITERATIONS ===${NC}"
        
        # Run Claude iteration
        if run_claude_iteration $iteration; then
            consecutive_failures=0
        else
            consecutive_failures=$((consecutive_failures + 1))
            
            # Stop if too many consecutive failures
            if [ $consecutive_failures -ge 3 ]; then
                echo -e "${RED}Too many consecutive failures. Stopping.${NC}"
                log_message "Stopped due to 3 consecutive failures"
                break
            fi
        fi
        
        # Check if all tasks are complete
        check_todo_status
        if [ $? -eq 0 ] && [ -f "src/index.ts" ]; then
            echo -e "${GREEN}All TODO items complete and core files exist!${NC}"
            log_message "Project appears to be complete"
            
            # Ask user if they want to continue
            echo "Continue with more iterations? (y/n)"
            read -r continue_choice
            if [ "$continue_choice" != "y" ]; then
                break
            fi
        fi
        
        # Sleep between iterations
        if [ $iteration -lt $MAX_ITERATIONS ]; then
            echo -e "${YELLOW}Sleeping for $SLEEP_BETWEEN_LOOPS seconds...${NC}"
            sleep $SLEEP_BETWEEN_LOOPS
        fi
        
        iteration=$((iteration + 1))
    done
    
    echo ""
    echo -e "${GREEN}=== Ralph Loop Complete ===${NC}"
    log_message "Ralph loop ended after $((iteration - 1)) iterations"
    
    # Final summary
    echo ""
    echo "Summary:"
    echo "- Total iterations: $((iteration - 1))"
    echo "- Log file: $LOG_FILE"
    echo "- Git commits created: $(git rev-list --count HEAD 2>/dev/null || echo "0")"
    
    # Show current TODO status
    echo ""
    echo "TODO Status:"
    if [ -f TODO.md ]; then
        echo "- Completed: $(grep -c "^- \[x\]" TODO.md 2>/dev/null || echo "0")"
        echo "- Remaining: $(grep -c "^- \[ \]" TODO.md 2>/dev/null || echo "0")"
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Ralph loop interrupted by user${NC}"; exit 1' INT

# Check if Claude is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: 'claude' command not found${NC}"
    echo "Please ensure Claude CLI is installed and in PATH"
    exit 1
fi

# Start the loop
main
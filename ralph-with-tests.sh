#!/bin/bash
# Enhanced Ralph Loop with Testing
# Implements continuous development with test validation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
MAX_ITERATIONS=100
SLEEP_BETWEEN_LOOPS=5
LOG_FILE="ralph.log"
CHECKPOINT_DIR="checkpoints"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$CHECKPOINT_DIR"

# Function to create git checkpoint
create_checkpoint() {
    local iteration=$1
    echo -e "${GREEN}Creating checkpoint for iteration $iteration${NC}"
    
    if [ ! -d .git ]; then
        git init
        git add .
        git commit -m "Initial Ralph checkpoint"
    fi
    
    git add -A
    git commit -m "Ralph iteration $iteration - $(date '+%Y-%m-%d %H:%M:%S')" || true
}

# Function to run tests
run_tests() {
    echo -e "${BLUE}Running tests...${NC}"
    
    # Check if tests exist
    if [ -d "tests" ] && [ -f "package.json" ]; then
        # Try to run tests
        npm test 2>&1 | tee test-results.log
        local test_exit_code=${PIPESTATUS[0]}
        
        if [ $test_exit_code -eq 0 ]; then
            echo -e "${GREEN}✓ Tests passed${NC}"
            return 0
        else
            echo -e "${RED}✗ Tests failed${NC}"
            
            # Document test failure in FIX_PLAN
            echo "" >> FIX_PLAN.md
            echo "### Issue: Test failure in iteration $1" >> FIX_PLAN.md
            echo "**Date**: $(date '+%Y-%m-%d %H:%M')" >> FIX_PLAN.md
            echo "**Severity**: High" >> FIX_PLAN.md
            echo "**Component**: Tests" >> FIX_PLAN.md
            echo "**Description**: Tests failed after iteration $1" >> FIX_PLAN.md
            echo "**Error**: See test-results.log" >> FIX_PLAN.md
            echo "**Status**: Open" >> FIX_PLAN.md
            
            return 1
        fi
    else
        echo -e "${YELLOW}No tests found yet${NC}"
        return 0
    fi
}

# Function to build project
build_project() {
    echo -e "${BLUE}Building project...${NC}"
    
    if [ -f "package.json" ]; then
        npm run build 2>&1 | tee build-results.log
        local build_exit_code=${PIPESTATUS[0]}
        
        if [ $build_exit_code -eq 0 ]; then
            echo -e "${GREEN}✓ Build successful${NC}"
            return 0
        else
            echo -e "${RED}✗ Build failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}No build configuration yet${NC}"
        return 0
    fi
}

# Function to log output
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check TODO status
check_todo_status() {
    if [ -f TODO.md ]; then
        local unchecked=$(grep -c "^- \[ \]" TODO.md 2>/dev/null || echo "0")
        return $unchecked
    else
        return 0
    fi
}

# Enhanced Claude iteration with testing
run_claude_iteration() {
    local iteration=$1
    log_message "Starting iteration $iteration"
    
    check_todo_status
    local todo_count=$?
    
    if [ $todo_count -eq 0 ]; then
        log_message "TODO is empty or complete, requesting new tasks..."
        echo -e "${YELLOW}Generating new TODO items...${NC}"
        
        claude --dangerously-skip-permissions << 'EOF'
Read PROMPT.md, TODO.md, and FIX_PLAN.md.
The TODO list is empty or complete. 
Based on the project progress, generate the next set of TODO items.
Update TODO.md with new tasks that need to be done.
Focus on the next logical phase of development.
EOF
    else
        log_message "Found $todo_count tasks in TODO"
        
        # Enhanced prompt with testing requirements
        claude --dangerously-skip-permissions << 'EOF'
Read PROMPT.md to understand the project.
Read TODO.md to see what needs to be done.
Read FIX_PLAN.md to check for any issues that need fixing.

Pick the next uncompleted task from TODO.md and implement it completely:
1. Create any necessary files
2. Write the full implementation with proper error handling
3. If implementing a new feature, also write a test for it in the tests/ directory
4. Ensure the code can be built (check package.json scripts)
5. Update TODO.md to mark the task as complete
6. If you encounter issues, document them in FIX_PLAN.md
7. If you discover new tasks, add them to TODO.md

IMPORTANT: 
- Write actual tests using Jest (already configured) when implementing features
- Tests should go in tests/ directory with .test.ts extension
- Ensure code is buildable by checking TypeScript compilation
- Follow the existing project structure

Current working directory: /home/john/repos/PlayClone/
EOF
    fi
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "Claude iteration completed"
        
        # Build the project
        if build_project; then
            log_message "Build successful"
        else
            log_message "Build failed - will retry next iteration"
            return 1
        fi
        
        # Run tests
        if run_tests $iteration; then
            log_message "Tests passed"
            create_checkpoint $iteration
            echo -e "${GREEN}✓ Iteration $iteration complete with passing tests${NC}"
            return 0
        else
            log_message "Tests failed - will fix next iteration"
            # Don't fail the iteration, let Claude fix it
            return 0
        fi
    else
        log_message "Iteration $iteration failed with exit code $exit_code"
        echo -e "${RED}✗ Iteration $iteration failed${NC}"
        return 1
    fi
}

# Main loop
main() {
    echo -e "${GREEN}=== Starting Enhanced Ralph Loop with Testing ===${NC}"
    log_message "Ralph loop started with testing enabled"
    
    local iteration=1
    local consecutive_failures=0
    
    while [ $iteration -le $MAX_ITERATIONS ]; do
        echo ""
        echo -e "${YELLOW}=== Iteration $iteration of $MAX_ITERATIONS ===${NC}"
        
        if run_claude_iteration $iteration; then
            consecutive_failures=0
        else
            consecutive_failures=$((consecutive_failures + 1))
            
            if [ $consecutive_failures -ge 3 ]; then
                echo -e "${RED}Too many consecutive failures. Stopping.${NC}"
                log_message "Stopped due to 3 consecutive failures"
                break
            fi
        fi
        
        # Check completion
        check_todo_status
        if [ $? -eq 0 ] && [ -f "src/index.ts" ]; then
            echo -e "${GREEN}All TODO items complete!${NC}"
            
            # Run final test suite
            echo -e "${BLUE}Running final test suite...${NC}"
            if run_tests "final"; then
                echo -e "${GREEN}🎉 Project complete with all tests passing!${NC}"
                log_message "Project completed successfully"
                break
            else
                echo -e "${YELLOW}Project complete but some tests failing${NC}"
                echo "Continue fixing tests? (y/n)"
                read -r continue_choice
                if [ "$continue_choice" != "y" ]; then
                    break
                fi
            fi
        fi
        
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
    echo "- Git commits: $(git rev-list --count HEAD 2>/dev/null || echo "0")"
    
    # Test summary
    if [ -f "test-results.log" ]; then
        echo "- Last test results: test-results.log"
    fi
    
    # TODO Status
    echo ""
    echo "TODO Status:"
    if [ -f TODO.md ]; then
        echo "- Completed: $(grep -c "^- \[x\]" TODO.md 2>/dev/null || echo "0")"
        echo "- Remaining: $(grep -c "^- \[ \]" TODO.md 2>/dev/null || echo "0")"
    fi
}

# Handle Ctrl+C
trap 'echo -e "\n${YELLOW}Ralph loop interrupted by user${NC}"; exit 1' INT

# Check Claude availability
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: 'claude' command not found${NC}"
    exit 1
fi

# Check Node.js for testing
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}Warning: npm not found - testing will be skipped${NC}"
fi

main
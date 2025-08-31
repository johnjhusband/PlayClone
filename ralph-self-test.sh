#!/bin/bash
# Ralph Loop with PlayClone Self-Testing
# The AI uses PlayClone to test PlayClone - true dogfooding!

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
MAGENTA='\033[0;35m'
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

# Function to run self-tests using PlayClone
run_self_tests() {
    local iteration=$1
    echo -e "${MAGENTA}=== Running PlayClone Self-Tests ===${NC}"
    log_message "Starting self-tests using PlayClone"
    
    # Ask Claude to test PlayClone using PlayClone itself
    claude --dangerously-skip-permissions << 'EOF'
You have been building PlayClone. Now you need to test it using PlayClone itself!

Read the current state of the project:
1. Check if src/index.ts exists and exports the main functions
2. Check if the build compiles: npm run build
3. Import PlayClone in a test script

Create a self-test file called "self-test.ts" that:
1. Imports PlayClone from './dist/index'
2. Uses PlayClone to navigate to a test website (e.g., example.com)
3. Uses PlayClone's natural language features to interact with the page
4. Tests core functionality: navigate, click, fill, extract text
5. Validates that responses are AI-friendly (under 1KB, structured JSON)
6. Tests the state management features
7. Outputs a test report

Example structure for self-test.ts:
```typescript
import { PlayClone } from './dist/index';

async function runSelfTest() {
    console.log('🧪 PlayClone Self-Test Starting...');
    
    const playclone = new PlayClone({
        headless: true,
        aiMode: true
    });
    
    try {
        // Test 1: Navigation
        const navResult = await playclone.navigate('https://example.com');
        console.assert(navResult.success, 'Navigation failed');
        console.assert(navResult.data.length < 1024, 'Response too large for AI');
        
        // Test 2: Natural language element selection
        const textResult = await playclone.getText('main heading');
        console.assert(textResult.success, 'Text extraction failed');
        
        // Test 3: Click with natural language
        const clickResult = await playclone.click('more information link');
        console.assert(clickResult.action === 'click', 'Click action failed');
        
        // Test 4: State management
        const stateSnapshot = await playclone.saveState('test-checkpoint');
        console.assert(stateSnapshot.success, 'State save failed');
        
        // Test 5: AI-optimized response format
        console.assert(JSON.stringify(navResult).length < 1024, 'Response not token-optimized');
        
        console.log('✅ All self-tests passed!');
        return true;
    } catch (error) {
        console.error('❌ Self-test failed:', error);
        return false;
    } finally {
        await playclone.close();
    }
}

runSelfTest().then(success => {
    process.exit(success ? 0 : 1);
});
```

After creating the self-test:
1. Compile it: npx tsc self-test.ts --outDir dist-test
2. Run it: node dist-test/self-test.js
3. Document the results in TEST_RESULTS.md
4. If tests fail, add issues to FIX_PLAN.md
5. If tests pass, update TODO.md to mark testing complete

This is meta-testing: using the tool you're building to test itself!
EOF
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "Self-test creation completed"
        
        # Check if self-test was created and run
        if [ -f "self-test.ts" ] || [ -f "tests/self-test.ts" ]; then
            echo -e "${GREEN}✓ Self-test created${NC}"
            
            # Try to run the self-test
            if [ -f "dist-test/self-test.js" ]; then
                echo -e "${BLUE}Executing self-test...${NC}"
                node dist-test/self-test.js
                local test_result=$?
                
                if [ $test_result -eq 0 ]; then
                    echo -e "${GREEN}✅ PlayClone passed self-testing!${NC}"
                    log_message "Self-tests passed"
                    return 0
                else
                    echo -e "${YELLOW}⚠️ Self-tests revealed issues${NC}"
                    log_message "Self-tests failed - needs fixing"
                    return 1
                fi
            fi
        fi
    else
        log_message "Self-test creation failed"
        return 1
    fi
}

# Main Claude iteration with self-testing
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

IMPORTANT: Consider adding self-testing tasks using PlayClone to test PlayClone itself.
This means creating tests where PlayClone is used to automate browsers and verify its own functionality.

Generate the next set of TODO items, including:
- Self-testing tasks using PlayClone
- Integration tests that use PlayClone's API
- Examples that demonstrate PlayClone testing itself

Update TODO.md with these new tasks.
EOF
    else
        log_message "Found $todo_count tasks in TODO"
        
        claude --dangerously-skip-permissions << 'EOF'
Read PROMPT.md to understand the project.
Read TODO.md to see what needs to be done.
Read FIX_PLAN.md to check for any issues that need fixing.

Pick the next uncompleted task from TODO.md and implement it completely:
1. Create any necessary files
2. Write the full implementation with proper error handling
3. Add TypeScript types and interfaces
4. Update TODO.md to mark the task as complete
5. If you encounter issues, document them in FIX_PLAN.md
6. If you discover new tasks, add them to TODO.md

SPECIAL INSTRUCTION: If you're implementing core PlayClone features, also create a self-test that uses PlayClone to test that feature. For example:
- If implementing navigate(), create a test that uses PlayClone to navigate and verify it worked
- If implementing click(), create a test where PlayClone clicks elements and verifies the action
- This is recursive testing - PlayClone testing PlayClone!

Focus on completing one task thoroughly before moving on.
Write actual, working code - not placeholders or comments about what should be done.

Current working directory: /home/john/repos/PlayClone/
EOF
    fi
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_message "Iteration $iteration completed successfully"
        echo -e "${GREEN}✓ Iteration $iteration complete${NC}"
        
        # Every 5 iterations, run self-tests
        if [ $((iteration % 5)) -eq 0 ]; then
            echo -e "${MAGENTA}Running self-tests (every 5 iterations)...${NC}"
            if run_self_tests $iteration; then
                echo -e "${GREEN}Self-tests passed!${NC}"
            else
                echo -e "${YELLOW}Self-tests need attention${NC}"
            fi
        fi
        
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
    echo -e "${MAGENTA}=== Starting Ralph Loop with PlayClone Self-Testing ===${NC}"
    echo -e "${MAGENTA}PlayClone will test PlayClone - the ultimate dogfooding!${NC}"
    log_message "Ralph loop started with self-testing enabled"
    
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
        
        # Check if all tasks are complete and core exists
        check_todo_status
        if [ $? -eq 0 ] && [ -f "src/index.ts" ]; then
            echo -e "${GREEN}All TODO items complete!${NC}"
            log_message "All tasks completed"
            
            # Run final comprehensive self-test
            echo -e "${MAGENTA}Running final PlayClone self-test suite...${NC}"
            if run_self_tests "final"; then
                echo -e "${GREEN}🎉 PlayClone successfully tested itself! Meta-testing complete!${NC}"
                log_message "Project completed with successful self-testing"
                break
            else
                echo -e "${YELLOW}Final self-tests need fixes${NC}"
                echo "Continue to fix self-tests? (y/n)"
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
    echo -e "${MAGENTA}=== Ralph Loop Complete ===${NC}"
    log_message "Ralph loop ended after $((iteration - 1)) iterations"
    
    # Final summary
    echo ""
    echo "Summary:"
    echo "- Total iterations: $((iteration - 1))"
    echo "- Log file: $LOG_FILE"
    echo "- Git commits: $(git rev-list --count HEAD 2>/dev/null || echo "0")"
    
    # Self-test summary
    if [ -f "TEST_RESULTS.md" ]; then
        echo "- Self-test results: TEST_RESULTS.md"
    fi
    
    # TODO Status
    echo ""
    echo "TODO Status:"
    if [ -f TODO.md ]; then
        echo "- Completed: $(grep -c "^- \[x\]" TODO.md 2>/dev/null || echo "0")"
        echo "- Remaining: $(grep -c "^- \[ \]" TODO.md 2>/dev/null || echo "0")"
    fi
    
    echo ""
    echo -e "${MAGENTA}PlayClone tested PlayClone - the circle is complete!${NC}"
}

# Handle Ctrl+C
trap 'echo -e "\n${YELLOW}Ralph loop interrupted by user${NC}"; exit 1' INT

# Check Claude availability
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: 'claude' command not found${NC}"
    echo "Please ensure Claude CLI is installed and in PATH"
    exit 1
fi

main
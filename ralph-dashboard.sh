#!/bin/bash

# Ralph Dashboard - Real-time monitoring interface

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Function to get task stats
get_task_stats() {
    local completed=$(grep -c "^\- \[x\]" TODO.md 2>/dev/null || echo 0)
    local pending=$(grep -c "^\- \[ \]" TODO.md 2>/dev/null || echo 0)
    local total=$((completed + pending))
    local percent=$((completed * 100 / total))
    echo "$completed|$pending|$total|$percent"
}

# Function to get current task
get_current_task() {
    grep "^\- \[ \]" TODO.md 2>/dev/null | head -1 | sed 's/- \[ \] //' | cut -c1-60
}

# Function to get iteration info
get_iteration() {
    tail -1 ralph.log 2>/dev/null | grep -oP 'iteration \K\d+' || echo "0"
}

# Function to draw progress bar
draw_progress_bar() {
    local percent=$1
    local width=50
    local filled=$((percent * width / 100))
    local empty=$((width - filled))
    
    printf "${GREEN}"
    printf '█%.0s' $(seq 1 $filled)
    printf "${WHITE}"
    printf '░%.0s' $(seq 1 $empty)
    printf "${NC}"
    echo " ${percent}%"
}

# Main dashboard loop
while true; do
    clear
    
    # Header
    echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${CYAN}                    🤖 RALPH LOOP DASHBOARD 🤖                        ${PURPLE}║${NC}"
    echo -e "${PURPLE}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    
    # Get stats
    IFS='|' read -r completed pending total percent <<< "$(get_task_stats)"
    current_task=$(get_current_task)
    iteration=$(tail -1 ralph.log | grep -oP 'iteration \K\d+' || echo "?")
    
    # Iteration info
    echo -e "${PURPLE}║${NC} ${YELLOW}Current Iteration:${NC} $iteration / 100                                      ${PURPLE}║${NC}"
    
    # Task progress
    echo -e "${PURPLE}║${NC} ${YELLOW}Task Progress:${NC}                                                      ${PURPLE}║${NC}"
    printf "${PURPLE}║${NC} "
    draw_progress_bar $percent
    printf "                          ${PURPLE}║${NC}\n"
    echo -e "${PURPLE}║${NC} ${GREEN}Completed:${NC} $completed  ${RED}Pending:${NC} $pending  ${BLUE}Total:${NC} $total                       ${PURPLE}║${NC}"
    
    # Current task
    echo -e "${PURPLE}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${PURPLE}║${NC} ${CYAN}Current Task:${NC}                                                       ${PURPLE}║${NC}"
    if [ -n "$current_task" ]; then
        printf "${PURPLE}║${NC} %-68s ${PURPLE}║${NC}\n" "$current_task"
    else
        echo -e "${PURPLE}║${NC} ${GREEN}All tasks completed!${NC}                                                ${PURPLE}║${NC}"
    fi
    
    # Recent activity
    echo -e "${PURPLE}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${PURPLE}║${NC} ${CYAN}Recent Activity:${NC}                                                    ${PURPLE}║${NC}"
    
    # Show last 3 log entries
    tail -3 ralph.log 2>/dev/null | while IFS= read -r line; do
        # Truncate line to fit
        line=$(echo "$line" | cut -c1-68)
        printf "${PURPLE}║${NC} ${WHITE}%-68s${NC} ${PURPLE}║${NC}\n" "$line"
    done
    
    # File activity
    echo -e "${PURPLE}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${PURPLE}║${NC} ${CYAN}Recent File Changes:${NC}                                                ${PURPLE}║${NC}"
    
    # Show recently modified files
    find /home/john/repos/PlayClone -type f -name "*.ts" -o -name "*.js" -o -name "*.md" 2>/dev/null | \
        xargs ls -lt 2>/dev/null | head -3 | while IFS= read -r line; do
        file=$(echo "$line" | awk '{print $NF}' | xargs basename | cut -c1-30)
        time=$(echo "$line" | awk '{print $8}')
        printf "${PURPLE}║${NC} ${WHITE}%-30s${NC} modified at ${GREEN}%-25s${NC}     ${PURPLE}║${NC}\n" "$file" "$time"
    done
    
    # Controls
    echo -e "${PURPLE}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${PURPLE}║${NC} ${YELLOW}Controls:${NC} [P]ause  [R]esume  [S]kip  [Q]uit  [L]ogs               ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    
    # Status indicator
    if pgrep -f "ralph.sh" > /dev/null; then
        echo -e "\n${GREEN}● Ralph is RUNNING${NC}"
    else
        echo -e "\n${RED}● Ralph is STOPPED${NC}"
    fi
    
    # Handle user input (with timeout)
    read -t 5 -n 1 -s key
    case $key in
        p|P) echo "pause" >> ralph-commands.txt ;;
        r|R) echo "resume" >> ralph-commands.txt ;;
        s|S) echo "skip" >> ralph-commands.txt ;;
        q|Q) break ;;
        l|L) tail -20 ralph.log; read -p "Press enter to continue..." ;;
    esac
done
#!/bin/bash

# Simplest possible Ralph loop
while true; do
    echo "Starting iteration..."
    
    claude --dangerously-skip-permissions -p "Read TODO.md. Pick the next uncompleted task and implement it. Update TODO.md when done."
    
    echo "Sleeping 5 seconds..."
    sleep 5
done
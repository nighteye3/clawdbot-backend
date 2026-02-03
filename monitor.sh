#!/bin/bash
PROJECT_DIR="/root/.openclaw/workspace/clawdbot-testing"
LOG_FILE="$PROJECT_DIR/monitor.log"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cd "$PROJECT_DIR"

if ! pgrep -f "node server.js" > /dev/null; then
    echo "[$TIMESTAMP] Server down! Restarting..." >> "$LOG_FILE"
    # Run node directly to save memory (skip npm wrapper)
    nohup node server.js >> "$LOG_FILE" 2>&1 &
else
    # echo "[$TIMESTAMP] Running..." >> "$LOG_FILE"
    :
fi

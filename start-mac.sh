#!/bin/bash
# start-mac.sh - Start IntelliView dev environment on macOS
# Usage: bash start-mac.sh
#   This starts: backend (port 3001) + frontend Vite dev server (port 5173) + Electron
#
#   Press Ctrl+C to stop all processes.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.pids"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}  =================================${NC}"
echo -e "${CYAN}   IntelliView - Dev Start (macOS)${NC}"
echo -e "${CYAN}  =================================${NC}"
echo ""
echo -e "${GRAY}  Usage: bash start-mac.sh [--clean]${NC}"
echo -e "${GRAY}    --clean : xoá Vite cache + dist rồi mới start${NC}"
echo ""

# ─── Check --clean flag ────────────────────────────────────────────────────────
if [ "${1:-}" = "--clean" ]; then
  echo -e "  ${YELLOW}Cleaning caches...${NC}"
  rm -rf "$ROOT/frontend/node_modules/.vite" "$ROOT/frontend/dist" 2>/dev/null
  echo -e "  ${GREEN}Done${NC}"
  echo ""
fi

# ─── Cleanup previous session ──────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${YELLOW}  Stopping all processes...${NC}"

  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null
        echo -e "  ${GRAY}Killed PID $pid${NC}"
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi

  # Also kill any orphan node/electron processes from this session
  # (belt-and-suspenders — for zombie processes that survived the PID file)
  echo -e "  ${GRAY}Cleaning up lingering processes...${NC}"
  # Kill any tsx watch / vite dev server on our ports
  lsof -ti:3001 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti:5173 2>/dev/null | xargs kill 2>/dev/null || true

  echo -e "${GREEN}  Done.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Kill leftover processes on our ports before starting
lsof -ti:3001 2>/dev/null | xargs kill 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill 2>/dev/null || true
sleep 0.5

# ─── 1. Start Backend ──────────────────────────────────────────────────────────
echo -e "  ${GREEN}[1/3] Starting backend...${NC}"
cd "$ROOT/backend"
NODE_OPTIONS='--use-system-ca' npx tsx watch src/index.ts > "$ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"
echo -e "        PID $BACKEND_PID  →  ${CYAN}http://localhost:3001${NC}"
echo -e "        ${GRAY}Logs: backend.log${NC}"

# ─── 2. Start Frontend (Vite) ─────────────────────────────────────────────────
echo -e "  ${GREEN}[2/3] Starting frontend (Vite)...${NC}"
cd "$ROOT/frontend"
npx vite --host > "$ROOT/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PID_FILE"
echo -e "        PID $FRONTEND_PID  →  ${CYAN}http://localhost:5173${NC}"
echo -e "        ${GRAY}Logs: frontend.log${NC}"

# ─── 3. Wait for both servers ─────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}Waiting for backend (port 3001)...${NC}"
BACKEND_READY=false
for i in $(seq 1 30); do
  if lsof -i:3001 -P 2>/dev/null | grep -q LISTEN; then
    BACKEND_READY=true
    echo -e "  ${GREEN}  Backend ready!${NC}"
    break
  fi
  sleep 0.5
done
if [ "$BACKEND_READY" = false ]; then
  echo -e "  ${YELLOW}  Backend not ready yet, launching anyway...${NC}"
fi

echo -e "  ${YELLOW}Waiting for Vite (port 5173)...${NC}"
FRONTEND_READY=false
for i in $(seq 1 30); do
  if lsof -i:5173 -P 2>/dev/null | grep -q LISTEN; then
    FRONTEND_READY=true
    echo -e "  ${GREEN}  Frontend ready!${NC}"
    break
  fi
  sleep 0.5
done
if [ "$FRONTEND_READY" = false ]; then
  echo -e "  ${YELLOW}  Frontend not ready yet, launching anyway...${NC}"
fi

# ─── 4. Launch Electron ───────────────────────────────────────────────────────
echo -e "  ${GREEN}[3/3] Launching Electron...${NC}"
cd "$ROOT/electron"
INTELLIVIEW_DEV=1 npx electron . >> "$ROOT/electron.log" 2>&1 &
ELECTRON_PID=$!
echo "$ELECTRON_PID" >> "$PID_FILE"
echo -e "        PID $ELECTRON_PID"
echo -e "        ${GRAY}Logs: electron.log${NC}"

echo ""
echo -e "${CYAN}  ─────────────────────────────────────${NC}"
echo -e "${CYAN}   All services running!${NC}"
echo -e "${CYAN}   Press Ctrl+C to stop everything.${NC}"
echo -e "${CYAN}  ─────────────────────────────────────${NC}"
echo ""

# Keep script alive so trap works
wait

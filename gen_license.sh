#!/bin/bash
# ============================================================
#  gen_license.sh - IntelliView License Key Generator (macOS)
#
#  Usage (interactive):
#    bash gen_license.sh
#
#  Usage (non-interactive):
#    bash gen_license.sh HWID-7BD0-9B7F             # 365 ngày (default)
#    bash gen_license.sh HWID-7BD0-9B7F 24h         # 24 giờ
#    bash gen_license.sh HWID-7BD0-9B7F 1week       # 1 tuần
#    bash gen_license.sh HWID-7BD0-9B7F 1year       # 1 năm
#    bash gen_license.sh HWID-7BD0-9B7F never       # vĩnh viễn (99 năm)
#    bash gen_license.sh HWID-7BD0-9B7F 90          # custom days
# ============================================================

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GENERATOR="$ROOT/tools/generate-license.mjs"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m'

# ─── Resolve duration string → days ────────────────────────────────────────────
resolve_days() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    24h)      echo 1     ;;
    1week|7d) echo 7     ;;
    1year|365d) echo 365 ;;
    never)    echo 36135 ;;
    *)
      # check if it's a positive number
      if [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 36500 ]; then
        echo "$1"
      else
        echo -1
      fi
      ;;
  esac
}

# ─── Check Node.js ─────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || {
  echo -e "\n${RED}[FAIL] Node.js not found.${NC}"
  echo -e "${YELLOW}  Install Node.js from https://nodejs.org${NC}"
  exit 1
}

if [ ! -f "$GENERATOR" ]; then
  echo -e "\n${RED}[FAIL] $GENERATOR not found.${NC}"
  exit 1
fi

# ─── Banner ────────────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${CYAN}  ┌──────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}  │       IntelliView - License Key Generator        │${NC}"
echo -e "${CYAN}  └──────────────────────────────────────────────────┘${NC}"
echo ""

# ─── Parse args ────────────────────────────────────────────────────────────────
HWID="${1:-}"
EXPIRES="${2:-}"

# Interactive: ask for HWID
if [ -z "$HWID" ]; then
  echo -e "${YELLOW}  Enter customer HWID (format: HWID-XXXX-XXXX):${NC}"
  echo -n -e "${GRAY}  > ${NC}"
  read -r HWID
  HWID="$(echo "$HWID" | xargs)"  # trim
fi

if [[ ! "$HWID" =~ ^HWID- ]]; then
  echo -e "\n${RED}[FAIL] HWID must start with 'HWID-'${NC}"
  exit 1
fi

echo -e "  HWID: ${MAGENTA}$HWID${NC}"

# ─── Resolve expiry ────────────────────────────────────────────────────────────
DAYS=""
LABEL=""

if [ -n "$EXPIRES" ]; then
  DAYS=$(resolve_days "$EXPIRES")
  if [ "$DAYS" -lt 0 ]; then
    echo -e "\n${RED}[FAIL] Invalid expiry: '$EXPIRES'${NC}"
    echo -e "${YELLOW}  Valid options: 24h, 1week, 1year, never, or days (1-36500)${NC}"
    exit 1
  fi
  case "$DAYS" in
    1)     LABEL="24 hours (1 day)" ;;
    7)     LABEL="7 days (1 week)" ;;
    365)   LABEL="365 days (1 year)" ;;
    36135) LABEL="Never (99 years)" ;;
    *)     LABEL="$DAYS days" ;;
  esac
else
  # Interactive: show menu
  echo ""
  echo -e "${YELLOW}  Select license duration:${NC}"
  echo ""
  echo -e "${WHITE}    [1]  24 hours    - Quick demo / trial${NC}"
  echo -e "${WHITE}    [2]  7 days      - 1 week trial${NC}"
  echo -e "${WHITE}    [3]  365 days    - 1 year (standard)${NC}"
  echo -e "${WHITE}    [4]  Never       - Lifetime (99 years)${NC}"
  echo -e "${GRAY}    [5]  Custom      - Enter number of days${NC}"
  echo ""
  echo -n -e "${YELLOW}  Choice (1-5): ${NC}"
  read -r choice

  case "$(echo "$choice" | xargs)" in
    1) DAYS=1;     LABEL="24 hours (1 day)" ;;
    2) DAYS=7;     LABEL="7 days (1 week)" ;;
    3) DAYS=365;   LABEL="365 days (1 year)" ;;
    4) DAYS=36135; LABEL="Never (99 years)" ;;
    5)
      echo -n -e "${YELLOW}  Number of days: ${NC}"
      read -r custom_days
      custom_days="$(echo "$custom_days" | xargs)"
      if [[ ! "$custom_days" =~ ^[0-9]+$ ]] || [ "$custom_days" -lt 1 ] || [ "$custom_days" -gt 36500 ]; then
        echo -e "\n${RED}[FAIL] Days must be between 1 and 36500${NC}"
        exit 1
      fi
      DAYS=$custom_days
      LABEL="$DAYS days"
      ;;
    *)
      echo -e "\n${RED}[FAIL] Invalid choice (enter 1-5)${NC}"
      exit 1
      ;;
  esac
fi

# ─── Confirm (skip if non-interactive) ─────────────────────────────────────────
echo ""
echo -e "${GRAY}  ┌──────────────────────────────────────────────────┐${NC}"
echo -e "${WHITE}  │  HWID:    $(printf '%-40s' "$HWID")│${NC}"
echo -e "${WHITE}  │  Expires: $(printf '%-40s' "$LABEL")│${NC}"
echo -e "${GRAY}  └──────────────────────────────────────────────────┘${NC}"

if [ -z "$2" ]; then
  echo ""
  echo -n -e "${YELLOW}  Generate key? (Enter = Yes / N = Cancel): ${NC}"
  read -r confirm
  if [ "$(echo "$confirm" | tr '[:lower:]' '[:upper:]')" = "N" ]; then
    echo -e "\n${GRAY}  Cancelled.${NC}"
    exit 0
  fi
fi

# ─── Generate ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Generating license key...${NC}"
echo ""

node "$GENERATOR" "$HWID" "$DAYS"

# Auto-copy key to clipboard
KEY_LINE=$(node "$GENERATOR" "$HWID" "$DAYS" 2>/dev/null | grep -E '^[A-Za-z0-9+/=]+\.[a-f0-9]+$' | head -1)
if [ -n "$KEY_LINE" ]; then
  echo "$KEY_LINE" | pbcopy
  echo -e "${GREEN}  ✅ Copied to clipboard automatically!${NC}"
fi

echo ""
if [ -z "$2" ]; then
  read -n 1 -s -r -p "  Press any key to exit..."
  echo ""
fi

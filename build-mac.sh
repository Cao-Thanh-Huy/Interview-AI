#!/bin/bash
# build-mac.sh - Build IntelliView for macOS (.app → .dmg)
# Usage: chmod +x build-mac.sh && ./build-mac.sh
# Output: dist-electron/IntelliView-X.X.X.dmg

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
ELECTRON="$ROOT/electron"
OUT="$ROOT/dist-electron"

START_TIME=$(date +%s)

echo ""
echo "  ======================================"
echo "   IntelliView - Build Pipeline (macOS)"
echo "  ======================================"

# Step 1: Build Frontend
echo ""
echo "=== Step 1/3 : Build React frontend ==="
cd "$FRONTEND"
npm run build
echo "  [OK] frontend/dist/ ready"

# Step 2: Bundle Backend
echo ""
echo "=== Step 2/3 : Bundle backend ==="
cd "$BACKEND"
npm run build:prod
echo "  [OK] backend/dist-pkg/index.js ready"

# Step 3: Build .app
echo ""
echo "=== Step 3/3 : Build Electron .app ==="
cd "$ELECTRON"

# Stage frontend
STAGING_FRONTEND="$ELECTRON/resources/frontend-dist"
rm -rf "$STAGING_FRONTEND"
mkdir -p "$STAGING_FRONTEND"
cp -R "$FRONTEND/dist/"* "$STAGING_FRONTEND/"
echo "  [OK] Frontend staged"

# Stage backend
STAGING_BACKEND="$ELECTRON/resources/app"
rm -rf "$STAGING_BACKEND"
mkdir -p "$STAGING_BACKEND"
cp "$BACKEND/dist-pkg/index.js" "$STAGING_BACKEND/index.js"
echo '{"type":"module"}' > "$STAGING_BACKEND/package.json"
echo "  [OK] Backend staged"

# Bundle node_modules (production deps)
NM_SRC="$BACKEND/node_modules"
NM_DST="$STAGING_BACKEND/node_modules"
mkdir -p "$NM_DST"
for pkg in "$NM_SRC"/*/; do
  name=$(basename "$pkg")
  cp -R "$pkg" "$NM_DST/$name" 2>/dev/null || true
done
echo "  [OK] node_modules staged"

# Build
npx electron-builder --mac --x64
echo ""
echo "  ========================================"
echo "   BUILD COMPLETE"
echo "  ========================================"

ELAPSED=$(( $(date +%s) - START_TIME ))
echo "  Time: ${ELAPSED}s"
echo "  Output: $OUT"
echo ""

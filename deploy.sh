#!/bin/bash

# Atomic symlink-based deployment script for LinkPlanter
# Updated: 2026-01-03 - Fixed PM2 stale state handling

set -e

COMMAND=${1:-prod}
PROJECT_USER="planter"
PROJECT_DIR="/home/$PROJECT_USER/app"
RELEASES_DIR="/home/$PROJECT_USER/releases"
CURRENT_LINK="/home/$PROJECT_USER/current"
ECOSYSTEM_CONFIG="/home/$PROJECT_USER/ecosystem.config.js"

cd "$PROJECT_DIR"

case $COMMAND in
  dev)
    echo "🌱 Starting LinkPlanter dev server..."
    echo "   Port: 3045 | URL: https://dev.linkplanter.com"
    echo ""
    PORT=3045 npm run dev
    exit 0
    ;;
esac

case $COMMAND in
  prod|prod-quick|prod-build|prod-swap|prod-rollback)
    ENV="prod"
    PORT=3047
    PM2_NAME="planter-prod"
    SITE_URL="https://linkplanter.com"
    ;;
  *)
    echo "❌ Invalid command: $COMMAND"
    echo ""
    echo "Usage:"
    echo "  DEV:"
    echo "    ./deploy.sh dev              Run dev server with HMR"
    echo ""
    echo "  PROD:"
    echo "    ./deploy.sh prod             Zero-downtime deploy"
    echo "    ./deploy.sh prod-quick       Quick restart (no rebuild)"
    echo "    ./deploy.sh prod-build       Build only (pre-stage)"
    echo "    ./deploy.sh prod-swap        Deploy pre-staged build"
    echo "    ./deploy.sh prod-rollback    Rollback to previous release"
    exit 1
    ;;
esac

case $COMMAND in
  *-quick) ACTION="quick" ;;
  *-build) ACTION="build" ;;
  *-swap)  ACTION="swap" ;;
  *-rollback) ACTION="rollback" ;;
  *)       ACTION="full" ;;
esac

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
NEW_RELEASE="$RELEASES_DIR/build-$TIMESTAMP"

echo "🌱 LinkPlanter Deploy: $ENV ($ACTION)"
echo "   Port: $PORT | PM2: $PM2_NAME | URL: $SITE_URL"
echo ""

mkdir -p "$RELEASES_DIR"

get_current_release() {
    if [ -L "$CURRENT_LINK" ]; then
        readlink "$CURRENT_LINK"
    else
        echo ""
    fi
}

get_previous_release() {
    local CURRENT=$(get_current_release)
    if [ -n "$CURRENT" ]; then
        local CURRENT_BUILD=$(basename "$CURRENT")
        ls -t "$RELEASES_DIR" | grep -v "$CURRENT_BUILD" | head -n 1
    else
        echo ""
    fi
}

# Start PM2 fresh from ecosystem config - always delete and recreate to avoid stale state
start_fresh() {
    echo "🔄 Ensuring clean PM2 state..."
    pm2 delete $PM2_NAME 2>/dev/null || true
    echo "🌱 Starting $PM2_NAME from ecosystem config..."
    pm2 start "$ECOSYSTEM_CONFIG" --only $PM2_NAME
}

wait_for_healthy() {
    local MAX_ATTEMPTS=${1:-20}
    echo "⏳ Waiting for server..."
    for i in $(seq 1 $MAX_ATTEMPTS); do
        if curl -f -s http://localhost:$PORT >/dev/null 2>&1; then
            echo "✅ Server ready on port $PORT"
            pm2 save
            return 0
        fi
        if [ $i -eq $MAX_ATTEMPTS ]; then
            echo "❌ Server failed to start"
            pm2 logs $PM2_NAME --lines 15
            return 1
        fi
        echo "  Attempt $i/$MAX_ATTEMPTS..."
        sleep 2
    done
}

start_and_verify() {
    local MAX_ATTEMPTS=${1:-20}
    start_fresh
    wait_for_healthy $MAX_ATTEMPTS
}

clear_stale_locks() {
    if [ -f ".next/lock" ]; then
        echo "🔓 Removing stale .next/lock file..."
        rm -f ".next/lock"
    fi
}

do_build() {
    clear_stale_locks

    # ---- Install dependencies from committed lockfile (U9 fleet standard) ----
    # Never build against ambient node_modules — package/lock bumps must ship.
    # Order: after SA-19 ref-pin (when present), before audit gate and build.
    # Gotcha: first deploy after editing deploy.sh may still run the old buffered
    # script; confirm "Installing dependencies" logs on the next deploy.
    if [ -f package-lock.json ]; then
        echo "Installing dependencies (npm ci)..."
        npm ci --include=dev --no-audit --no-fund || {
            echo "DEPLOY BLOCKED: npm ci failed (package.json / package-lock.json out of sync?)"
            exit 1
        }
    elif [ -f bun.lock ] || [ -f bun.lockb ]; then
        echo "Installing dependencies (bun install --frozen-lockfile)..."
        bun install --frozen-lockfile || {
            echo "DEPLOY BLOCKED: bun install --frozen-lockfile failed (lockfile out of sync?)"
            exit 1
        }
    else
        echo "DEPLOY BLOCKED: no package-lock.json or bun.lock — commit a lockfile before deploy"
        exit 1
    fi

    echo "🏗️  Building Next.js (standalone mode)..."

    NEXT_PUBLIC_SITE_URL=$SITE_URL \
    NEXT_PUBLIC_BASE_URL=$SITE_URL \
    NODE_ENV=production \
    PORT=$PORT npm run build

    mkdir -p "$NEW_RELEASE"
    cp -r .next/standalone/. "$NEW_RELEASE/"
    cp -r public "$NEW_RELEASE/public" 2>/dev/null || true
    cp -r .next/static "$NEW_RELEASE/.next/static"
    cp package.json "$NEW_RELEASE/" 2>/dev/null || true

    echo "✅ Build complete → $NEW_RELEASE"
    echo "   Size: $(du -sh $NEW_RELEASE | cut -f1)"
}

do_swap() {
    local RELEASE_TO_DEPLOY="$1"
    [ -z "$RELEASE_TO_DEPLOY" ] && RELEASE_TO_DEPLOY="$NEW_RELEASE"

    if [ ! -d "$RELEASE_TO_DEPLOY" ]; then
        echo "❌ Release not found: $RELEASE_TO_DEPLOY"
        exit 1
    fi

    echo "🔄 Swapping to release: $(basename $RELEASE_TO_DEPLOY)"
    local OLD_RELEASE=$(get_current_release)

    ln -sfn "$RELEASE_TO_DEPLOY" "$CURRENT_LINK"
    echo "✅ Symlink updated: current -> $(basename $RELEASE_TO_DEPLOY)"

    if ! start_and_verify 25; then
        echo "🔄 Health check failed, rolling back..."
        if [ -n "$OLD_RELEASE" ] && [ -d "$OLD_RELEASE" ]; then
            ln -sfn "$OLD_RELEASE" "$CURRENT_LINK"
            start_fresh
            wait_for_healthy 10
            echo "⚠️  Rolled back to: $(basename $OLD_RELEASE)"
        fi
        exit 1
    fi

    echo "🧹 Cleaning old releases (keeping last 3)..."
    cd "$RELEASES_DIR"
    ls -t | tail -n +4 | xargs -r rm -rf

    echo "✅ Swap complete!"
}

case $ACTION in
  "quick")
    echo "⚡ Quick restart (no rebuild)..."
    start_and_verify 15
    ;;
  "build")
    echo "📦 Build only (site stays up)..."
    do_build
    echo ""
    echo "📍 To deploy: ./deploy.sh prod-swap"
    ;;
  "swap")
    if [ ! -d "$NEW_RELEASE" ]; then
        LATEST=$(ls -t "$RELEASES_DIR" | head -n 1)
        if [ -n "$LATEST" ]; then
            NEW_RELEASE="$RELEASES_DIR/$LATEST"
            echo "📍 Using most recent staged build: $(basename $NEW_RELEASE)"
        else
            echo "❌ No staged builds found. Run './deploy.sh prod-build' first."
            exit 1
        fi
    fi
    do_swap "$NEW_RELEASE"
    ;;
  "rollback")
    PREV=$(get_previous_release)
    if [ -z "$PREV" ]; then
        echo "❌ No previous release found to rollback to"
        exit 1
    fi
    echo "⏪ Rolling back to previous release: $PREV"
    do_swap "$RELEASES_DIR/$PREV"
    ;;
  "full")
    echo "🔄 Zero-downtime deploy..."
    do_build
    do_swap "$NEW_RELEASE"
    ;;
esac

echo ""
echo "🌱 Done!"
pm2 list 2>/dev/null || true
echo ""
echo "Prod ($PORT): $(curl -f -s http://localhost:$PORT >/dev/null 2>&1 && echo "✅ UP" || echo "⬜ down")"
echo "Public:      $(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $SITE_URL 2>/dev/null || echo 'N/A')  $SITE_URL"

#!/bin/bash

# Atomic symlink-based deployment script for LinkPlanter
# Updated: December 2025
#
# Usage:
#   DEV (no PM2):
#     ./deploy.sh dev           - Run dev server with HMR
#
#   PROD (PM2 managed, zero-downtime):
#     ./deploy.sh prod          - Zero-downtime deploy
#     ./deploy.sh prod-quick    - Quick restart (no rebuild)
#     ./deploy.sh prod-build    - Build only (pre-stage)
#     ./deploy.sh prod-swap     - Deploy pre-staged build
#     ./deploy.sh prod-rollback - Rollback to previous release

set -e

COMMAND=${1:-prod}
PROJECT_USER="planter"
PROJECT_DIR="/home/$PROJECT_USER/app"
RELEASES_DIR="/home/$PROJECT_USER/releases"
CURRENT_LINK="/home/$PROJECT_USER/current"
ECOSYSTEM_CONFIG="/home/$PROJECT_USER/ecosystem.config.js"

cd "$PROJECT_DIR"

# ============================================
# DEV COMMANDS (simple, no PM2)
# ============================================
case $COMMAND in
  dev)
    echo "🌱 Starting LinkPlanter dev server..."
    echo "   Port: 3045 | URL: https://dev.linkplanter.com"
    echo ""
    echo "   Press Ctrl+C to stop"
    echo ""
    PORT=3045 npm run dev
    exit 0
    ;;
esac

# ============================================
# PROD COMMANDS (PM2 managed)
# ============================================
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

# Determine action
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

# Ensure releases directory exists
mkdir -p "$RELEASES_DIR"

# Function to get current release path
get_current_release() {
    if [ -L "$CURRENT_LINK" ]; then
        readlink "$CURRENT_LINK"
    else
        echo ""
    fi
}

# Function to get previous release
get_previous_release() {
    local CURRENT=$(get_current_release)
    if [ -n "$CURRENT" ]; then
        local CURRENT_BUILD=$(basename "$CURRENT")
        ls -t "$RELEASES_DIR" | grep -v "$CURRENT_BUILD" | head -n 1
    else
        echo ""
    fi
}

# Function to start PM2 and verify
start_and_verify() {
    local MAX_ATTEMPTS=${1:-20}

    echo "🌱 Starting $PM2_NAME..."
    pm2 start "$ECOSYSTEM_CONFIG" --only $PM2_NAME 2>/dev/null || pm2 restart $PM2_NAME

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

# Function to do the build (standalone mode)
do_build() {
    echo "🏗️  Building Next.js (standalone mode)..."

    # Build with environment variables
    NEXT_PUBLIC_SITE_URL=$SITE_URL \
    NEXT_PUBLIC_BASE_URL=$SITE_URL \
    NODE_ENV=production \
    PORT=$PORT npm run build

    # Create release directory structure
    mkdir -p "$NEW_RELEASE"

    # Copy standalone output (server.js, node_modules, package.json)
    cp -r .next/standalone/. "$NEW_RELEASE/"

    # Copy public folder
    cp -r public "$NEW_RELEASE/public" 2>/dev/null || true

    # Merge .next directories:
    # 1. standalone/.next has BUILD_ID, server/, manifests
    # 2. .next/static has the static files
    # The cp -r .next/standalone/* already copied .next, now add static
    cp -r .next/static "$NEW_RELEASE/.next/static"

    # Copy package.json for reference
    cp package.json "$NEW_RELEASE/" 2>/dev/null || true

    echo "✅ Build complete → $NEW_RELEASE"
    echo "   Size: $(du -sh $NEW_RELEASE | cut -f1)"
}

# Function to swap releases (atomic symlink)
do_swap() {
    local RELEASE_TO_DEPLOY="$1"

    if [ -z "$RELEASE_TO_DEPLOY" ]; then
        RELEASE_TO_DEPLOY="$NEW_RELEASE"
    fi

    if [ ! -d "$RELEASE_TO_DEPLOY" ]; then
        echo "❌ Release not found: $RELEASE_TO_DEPLOY"
        exit 1
    fi

    echo "🔄 Swapping to release: $(basename $RELEASE_TO_DEPLOY)"

    local OLD_RELEASE=$(get_current_release)

    # Atomic symlink swap
    ln -sfn "$RELEASE_TO_DEPLOY" "$CURRENT_LINK"

    echo "✅ Symlink updated: current -> $(basename $RELEASE_TO_DEPLOY)"

    # Graceful PM2 reload
    pm2 reload $PM2_NAME --update-env 2>/dev/null || pm2 restart $PM2_NAME

    # Health check
    if ! start_and_verify 25; then
        echo "🔄 Health check failed, rolling back..."
        if [ -n "$OLD_RELEASE" ] && [ -d "$OLD_RELEASE" ]; then
            ln -sfn "$OLD_RELEASE" "$CURRENT_LINK"
            pm2 reload $PM2_NAME
            echo "⚠️  Rolled back to: $(basename $OLD_RELEASE)"
        fi
        exit 1
    fi

    # Cleanup old releases (keep last 3)
    echo "🧹 Cleaning old releases (keeping last 3)..."
    cd "$RELEASES_DIR"
    ls -t | tail -n +4 | xargs -r rm -rf

    echo "✅ Swap complete!"
    echo "   Active: $(basename $RELEASE_TO_DEPLOY)"
    if [ -n "$OLD_RELEASE" ]; then
        echo "   Previous: $(basename $OLD_RELEASE)"
    fi
}

# Execute action
case $ACTION in
  "quick")
    echo "⚡ Quick restart (no rebuild)..."
    pm2 reload $PM2_NAME 2>/dev/null || pm2 start "$ECOSYSTEM_CONFIG" --only $PM2_NAME

    for i in {1..15}; do
        if curl -f -s http://localhost:$PORT >/dev/null 2>&1; then
            echo "✅ Restarted!"
            pm2 save
            break
        fi
        [ $i -eq 15 ] && { echo "❌ Failed"; pm2 logs $PM2_NAME --lines 10; exit 1; }
        sleep 1
    done
    ;;

  "build")
    echo "📦 Build only (site stays up)..."
    do_build
    echo ""
    echo "📍 To deploy: ./deploy.sh prod-swap"
    ;;

  "swap")
    # If NEW_RELEASE doesn't exist, find most recent non-current release
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
    echo "   Site stays UP during build!"
    echo ""

    # Build while site is running
    do_build

    # Atomic swap
    do_swap "$NEW_RELEASE"
    ;;
esac

echo ""
echo "🌱 Done!"
echo ""
echo "Status:"
pm2 list 2>/dev/null || true
echo ""
echo "Prod ($PORT): $(curl -f -s http://localhost:$PORT >/dev/null 2>&1 && echo "✅ UP" || echo "⬜ down")"

#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <TAILSCALE_AUTH_KEY> [SERVER_IP] [SERVER_PORT]"
  exit 1
fi

export TAILSCALE_AUTH_KEY="$1"
export TAILSCALE_SERVER_IP="${2:-100.109.89.122}"
export TAILSCALE_SERVER_PORT="${3:-3000}"

export VITE_PRIMARY_API_URL="${VITE_PRIMARY_API_URL:-http://127.0.0.1:3001}"
export VITE_FALLBACK_API_URL="${VITE_FALLBACK_API_URL:-https://desktop-0kscckj.tail501d29.ts.net}"
export VITE_TERTIARY_API_URL="${VITE_TERTIARY_API_URL:-https://la-caja-8i4h.onrender.com}"

echo "TAILSCALE_SERVER_IP=${TAILSCALE_SERVER_IP}"
echo "TAILSCALE_SERVER_PORT=${TAILSCALE_SERVER_PORT}"
echo "VITE_PRIMARY_API_URL=${VITE_PRIMARY_API_URL}"
echo "VITE_FALLBACK_API_URL=${VITE_FALLBACK_API_URL}"
echo "VITE_TERTIARY_API_URL=${VITE_TERTIARY_API_URL}"

cd apps/desktop
npm run tauri dev

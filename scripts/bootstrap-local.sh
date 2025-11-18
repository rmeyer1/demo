#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

copy_if_missing() {
  local src="$1"
  local dest="$2"
  if [[ ! -f "$dest" ]]; then
    echo "Creating $(realpath --relative-to="$ROOT_DIR" "$dest") from template"
    cp "$src" "$dest"
  else
    echo "Skipping $(realpath --relative-to="$ROOT_DIR" "$dest") (already exists)"
  fi
}

# 1) Ensure env files exist
copy_if_missing "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
copy_if_missing "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"

# 2) Install dependencies and generate Prisma client
echo "Installing backend dependencies..."
(cd "$ROOT_DIR/backend" && npm install && npm run prisma:generate)

if [[ -d "$ROOT_DIR/frontend" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR/frontend" && npm install)
fi

echo "Bootstrap complete. Update any placeholder values in .env files before running the app."

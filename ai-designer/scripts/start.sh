#!/bin/sh
# Container entrypoint: keeps the database and files on the persistent volume, updates tables, starts the server.
set -e
DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-${DATA_DIR:-/data}}"
mkdir -p "$DATA_DIR"
case "${DATABASE_URL:-}" in
  ""|file:*) export DATABASE_URL="file:$DATA_DIR/designer.db" ;;
esac
case "${STORAGE_DIR:-}" in
  "$DATA_DIR"/*) ;;
  *) export STORAGE_DIR="$DATA_DIR/storage" ;;
esac
if [ -n "${RAILWAY_ENVIRONMENT_NAME:-}${RAILWAY_PROJECT_ID:-}" ] && [ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
  echo "⚠ No volume attached: brands, designs and files will be lost on the next deploy."
fi
echo "Data: $DATABASE_URL · files: $STORAGE_DIR"
npx prisma db push --skip-generate
exec node server.js

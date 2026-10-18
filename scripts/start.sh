#!/bin/sh
# Container entrypoint. Keeps the database and uploads on the persistent volume so deploys never wipe them.
set -e

DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-${DATA_DIR:-/data}}"
mkdir -p "$DATA_DIR"

# A SQLite path outside the volume (e.g. file:./cizaro.db copied from .env.example) would live on the
# container's throwaway disk. Force it onto the volume; Postgres URLs are left alone.
case "${DATABASE_URL:-}" in
  ""|file:*)
    want="file:$DATA_DIR/cizaro.db"
    if [ -n "${DATABASE_URL:-}" ] && [ "$DATABASE_URL" != "$want" ]; then
      echo "⚠ DATABASE_URL=$DATABASE_URL is outside the data volume; using $want instead"
    fi
    export DATABASE_URL="$want"
    ;;
esac
case "${STORAGE_DIR:-}" in
  "$DATA_DIR"/*) ;;
  *) export STORAGE_DIR="$DATA_DIR/storage" ;;
esac

if [ -n "${RAILWAY_ENVIRONMENT_NAME:-}${RAILWAY_PROJECT_ID:-}" ] && [ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
  echo "⚠⚠ NO RAILWAY VOLUME ATTACHED: tasks, accounts and files will be lost on the next deploy."
  echo "⚠⚠ Attach a volume to this service (any mount path, /data recommended)."
fi

echo "Data: $DATABASE_URL · files: $STORAGE_DIR"
npx prisma db push --skip-generate
node prisma/seed.mjs || true
exec node server.js

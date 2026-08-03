#!/bin/sh
set -e

cd "$(dirname "$0")/.."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Add PostgreSQL in Railway and link it to this service."
  exit 1
fi

echo "Applying database schema..."
npx prisma db push

echo "Seeding database..."
npx tsx prisma/seed.ts

echo "Starting server on 0.0.0.0:${PORT:-3001}..."
exec node dist/index.js

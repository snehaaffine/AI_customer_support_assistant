#!/bin/sh
set -e

cd "$(dirname "$0")/.."
export PATH="$(pwd)/node_modules/.bin:$PATH"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "On Railway: add a Postgres+pgvector service, then reference its DATABASE_URL on this web service."
  exit 1
fi

echo "Waiting for database..."
i=0
until node --input-type=module -e "
import net from 'node:net';
const u = new URL(process.env.DATABASE_URL);
const host = u.hostname;
const port = Number(u.port || 5432);
const socket = net.connect({ host, port }, () => {
  socket.end();
  process.exit(0);
});
socket.setTimeout(2000, () => {
  socket.destroy();
  process.exit(1);
});
socket.on('error', () => process.exit(1));
" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "ERROR: Database not reachable from DATABASE_URL after 60s."
    exit 1
  fi
  sleep 1
done
echo "Database is reachable."

SCHEMA="prisma/schema.prisma"

echo "Ensuring pgvector extension exists..."
if ! printf '%s\n' 'CREATE EXTENSION IF NOT EXISTS vector;' | prisma db execute --stdin --schema "$SCHEMA"; then
  echo "ERROR: Could not enable the pgvector extension."
  echo "This app requires PostgreSQL with pgvector (local docker-compose uses pgvector/pgvector:pg16)."
  echo "Railway's default Postgres plugin does NOT include pgvector, so schema setup fails and the"
  echo "server never starts — Railway health checks then fail forever."
  echo ""
  echo "Fix: deploy a database from Docker image 'pgvector/pgvector:pg16',"
  echo "set DATABASE_URL on this service to that database, and redeploy."
  exit 1
fi

echo "Applying database schema..."
if ! prisma db push --skip-generate --schema "$SCHEMA"; then
  echo "ERROR: prisma db push failed."
  echo "If the error mentions 'vector' or an extension, your database is missing pgvector."
  echo "Use Docker image pgvector/pgvector:pg16 for the database service on Railway."
  exit 1
fi

# Bind immediately so Railway health checks can succeed while seed runs
echo "Starting server on 0.0.0.0:${PORT:-3001}..."
node dist/index.js &
SERVER_PID=$!
trap 'kill -TERM "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID"' TERM INT

# If the server exits early, fail the container (healthcheck will also fail)
sleep 2
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "ERROR: Server process exited during startup."
  wait "$SERVER_PID" || true
  exit 1
fi

echo "Seeding database (non-fatal)..."
if ! tsx prisma/seed.ts; then
  echo "WARNING: Seed failed — server is still running for health checks."
fi

wait "$SERVER_PID"

#!/bin/sh
# Brings the database up to the running code, then hands PID 1 to the server so a
# `docker stop` reaches its SIGTERM handler and the connection pool closes cleanly.
set -e

cd /app/apps/api

echo "Applying migrations..."
./node_modules/.bin/tsx scripts/migrate.ts

# Seeding TRUNCATEs the store, so it never happens on its own. Set it for a first boot
# against an empty database, or when resetting a demo, then unset it again.
if [ "${SEED_ON_START}" = "true" ]; then
  echo "SEED_ON_START=true - truncating and reseeding the store..."
  ./node_modules/.bin/tsx scripts/seed.ts
fi

# Kept in step with the `start` script in apps/api/package.json.
exec ./node_modules/.bin/tsx --import ./src/telemetry/instrumentation.ts src/server.ts

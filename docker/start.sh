#!/bin/sh
# Starts the server with settings from Doppler when the container has a DOPPLER_TOKEN; otherwise from its own
# environment. Migrations run as the server starts.
set -e
if [ -n "$DOPPLER_TOKEN" ]; then
  exec doppler run -- npx tsx src/server/main.ts
fi
exec npx tsx src/server/main.ts

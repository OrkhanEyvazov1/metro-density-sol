#!/bin/sh
# Start generator in background, then uvicorn in foreground.
# BACKEND_URL defaults to local loopback so generator talks to co-located API.
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${PORT:-8000}/api/density}"

python -m generator.generator &
GENERATOR_PID=$!

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

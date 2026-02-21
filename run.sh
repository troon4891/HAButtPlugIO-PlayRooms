#!/usr/bin/with-contenv bashio

INTIFACE_PORT=$(bashio::config 'intiface_port')
SERVER_PORT=$(bashio::config 'server_port')
SCAN_ON_START=$(bashio::config 'scan_on_start')

bashio::log.info "Starting Intiface Engine on port ${INTIFACE_PORT}..."

# Start Intiface Engine in background
intiface-engine --wsinsecureport "${INTIFACE_PORT}" --stayopen &
INTIFACE_PID=$!

# Wait for Intiface Engine to be ready
sleep 3

if ! kill -0 "${INTIFACE_PID}" 2>/dev/null; then
  bashio::log.error "Intiface Engine failed to start"
  exit 1
fi

bashio::log.info "Intiface Engine started (PID: ${INTIFACE_PID})"
bashio::log.info "Starting PlayRooms server on port ${SERVER_PORT}..."

# Export configuration for Node.js server
export INTIFACE_PORT="${INTIFACE_PORT}"
export SERVER_PORT="${SERVER_PORT}"
export SCAN_ON_START="${SCAN_ON_START}"
export DATA_DIR="/config"

# Start Node.js server
exec node /app/server/dist/index.js

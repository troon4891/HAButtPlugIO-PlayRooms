#!/usr/bin/with-contenv bashio

INTIFACE_PORT=$(bashio::config 'intiface_port')
SERVER_PORT=$(bashio::config 'server_port')
SCAN_ON_START=$(bashio::config 'scan_on_start')

# Export configuration for Node.js server
export INTIFACE_PORT="${INTIFACE_PORT}"
export SERVER_PORT="${SERVER_PORT}"
export SCAN_ON_START="${SCAN_ON_START}"
export DATA_DIR="/config"

bashio::log.info "Starting PlayRooms server on port ${SERVER_PORT}..."

# Start Node.js server (manages Intiface Engine internally)
exec node /app/server/dist/index.js

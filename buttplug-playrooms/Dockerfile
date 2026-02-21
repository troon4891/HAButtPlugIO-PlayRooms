# Default allows local `docker build` without --build-arg; HA Supervisor always overrides
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.19
FROM ${BUILD_FROM}

# Pin intiface-engine version for reproducible builds
ARG INTIFACE_ENGINE_VERSION=v1.4.8

# Install Node.js and runtime dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    wget \
    unzip \
    bluez \
    dbus \
    libc6-compat

# Download and install Intiface Engine (amd64 only)
RUN wget -q -O /tmp/intiface-engine.zip \
      "https://github.com/intiface/intiface-engine/releases/download/${INTIFACE_ENGINE_VERSION}/intiface-engine-linux-x64-Release.zip" && \
    unzip -o /tmp/intiface-engine.zip intiface-engine -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/intiface-engine && \
    rm /tmp/intiface-engine.zip && \
    apk del unzip

# Copy and build server
COPY server/package.json server/package-lock.json* /app/server/
WORKDIR /app/server
RUN npm ci --production=false

COPY server/ /app/server/
RUN npm run build

# Copy and build client
COPY client/package.json client/package-lock.json* /app/client/
WORKDIR /app/client
RUN npm ci --production=false

COPY client/ /app/client/
RUN npm run build

# Serve client build via Express static middleware
RUN mkdir -p /app/server/public && \
    cp -r /app/client/dist/* /app/server/public/

# Clean up build dependencies
WORKDIR /app/server
RUN npm prune --production

COPY run.sh /
RUN chmod +x /run.sh

CMD ["/run.sh"]

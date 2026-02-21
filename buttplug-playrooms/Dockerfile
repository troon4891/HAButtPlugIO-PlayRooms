ARG BUILD_FROM
FROM ${BUILD_FROM}

ARG BUILD_ARCH

# Install Node.js 20 and build dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    wget \
    bluez \
    dbus

# Download Intiface Engine for the target architecture
RUN if [ "${BUILD_ARCH}" = "amd64" ]; then \
      INTIFACE_ARCH="x86_64-unknown-linux-musl"; \
    elif [ "${BUILD_ARCH}" = "aarch64" ]; then \
      INTIFACE_ARCH="aarch64-unknown-linux-musl"; \
    else \
      echo "Unsupported architecture: ${BUILD_ARCH}" && exit 1; \
    fi && \
    wget -q -O /tmp/intiface-engine.tar.gz \
      "https://github.com/intiface/intiface-engine/releases/latest/download/intiface-engine-linux-${INTIFACE_ARCH}.tar.gz" && \
    tar -xzf /tmp/intiface-engine.tar.gz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/intiface-engine && \
    rm /tmp/intiface-engine.tar.gz

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

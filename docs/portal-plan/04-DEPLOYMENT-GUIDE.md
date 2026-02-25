# Deployment Guide: PlayRoom Portal on a VPS

How to deploy the PlayRoom Portal relay server on a cheap VPS.

---

## VPS Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| **CPU** | 1 core | 1 core | I/O-bound relay, not CPU-intensive |
| **RAM** | 512 MB | 1 GB | Node.js ~50MB idle + ~50KB per Socket.IO connection |
| **Storage** | 5 GB | 20 GB | App < 200MB, rest is OS + logs |
| **Bandwidth** | 100 GB/month | 1000 GB/month | Small Socket.IO messages; WebRTC P2P bypasses portal |
| **OS** | Linux (Debian/Ubuntu) | Ubuntu 22.04+ | Docker compatible |

### Capacity Estimate (1GB RAM VPS)

```
Total RAM:          1024 MB
OS overhead:        ~200 MB
Node.js base:      ~50  MB
Available:          ~774 MB

Per guest:          ~50 KB (Socket.IO connection + bridge state)
Max guests:         ~15,000 concurrent (theoretical)
Practical limit:    ~1,000 concurrent (with headroom)
```

CPU is not the bottleneck — Socket.IO event forwarding is I/O-bound. A single core handles thousands of concurrent connections easily.

**Bandwidth math**: Each device command is ~200 bytes. At 10 commands/second for 10 guests = 20KB/sec = 1.7GB/day = ~52GB/month. Chat messages add negligibly. WebRTC video/voice goes P2P and does NOT transit the portal. 1000GB bandwidth is far more than sufficient.

---

## Recommended VPS Providers

| Provider | Plan | Price | Specs |
|----------|------|-------|-------|
| Hetzner Cloud CX22 | Cloud | ~$4/month | 2 CPU, 4GB RAM, 40GB SSD |
| DigitalOcean | Basic Droplet | $4-6/month | 1 CPU, 1GB RAM, 25GB SSD |
| Vultr | Cloud Compute | $5/month | 1 CPU, 1GB RAM, 25GB SSD |
| OVH | Starter VPS | ~$4/month | 1 CPU, 2GB RAM, 20GB SSD |
| Linode (Akamai) | Nanode 1GB | $5/month | 1 CPU, 1GB RAM, 25GB SSD |
| Railway | Starter | ~$5/month | Auto-scaled |
| Fly.io | Machines | Free tier / ~$5/month | Auto-scaled |

---

## Deployment Option 1: Docker (Recommended)

### Step 1: Build the Image

On your development machine or CI:

```bash
cd buttplug-playrooms
docker build --build-arg PORTAL_MODE=true -t playrooms-portal .
```

The `PORTAL_MODE=true` build arg **skips downloading Intiface Engine**, making the image smaller.

### Step 2: Push to Container Registry

```bash
# Docker Hub
docker tag playrooms-portal yourusername/playrooms-portal:latest
docker push yourusername/playrooms-portal:latest

# Or GitHub Container Registry
docker tag playrooms-portal ghcr.io/yourusername/playrooms-portal:latest
docker push ghcr.io/yourusername/playrooms-portal:latest
```

### Step 3: Deploy on VPS

SSH into your VPS:

```bash
# Install Docker if not already
curl -fsSL https://get.docker.com | sh

# Pull and run
docker run -d \
  --name playrooms-portal \
  --restart unless-stopped \
  -p 8080:8080 \
  -e PORTAL_MODE=true \
  -e RELAY_SECRET=your-secret-here-at-least-48-chars-of-random-hex \
  -e CORS_ORIGINS="*" \
  yourusername/playrooms-portal:latest
```

### Step 4: Verify

```bash
curl http://your-vps-ip:8080/api/health
```

Expected:
```json
{
  "status": "ok",
  "mode": "portal",
  "version": "2.0.1",
  "connectedInstances": 0,
  "connectedGuests": 0
}
```

---

## Deployment Option 2: Docker Compose

Create `docker-compose.yml` on your VPS:

```yaml
version: '3.8'

services:
  portal:
    image: yourusername/playrooms-portal:latest
    container_name: playrooms-portal
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      PORTAL_MODE: "true"
      RELAY_SECRET: "${RELAY_SECRET}"
      CORS_ORIGINS: "*"
      PORTAL_GRACE_PERIOD_MS: "60000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Create `.env` file:

```bash
RELAY_SECRET=your-secret-here-generate-with-openssl-rand-hex-48
```

Run:

```bash
docker compose up -d
docker compose logs -f portal
```

---

## Deployment Option 3: Docker Compose with Caddy (HTTPS)

For production with automatic TLS:

```yaml
version: '3.8'

services:
  portal:
    image: yourusername/playrooms-portal:latest
    container_name: playrooms-portal
    restart: unless-stopped
    expose:
      - "8080"
    environment:
      PORTAL_MODE: "true"
      RELAY_SECRET: "${RELAY_SECRET}"
      CORS_ORIGINS: "https://portal.yourdomain.com"

  caddy:
    image: caddy:2
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

Create `Caddyfile`:

```
portal.yourdomain.com {
    reverse_proxy portal:8080
}
```

Caddy automatically provisions Let's Encrypt certificates. No manual TLS setup needed.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORTAL_MODE` | Yes | `false` | Set to `true` to run as portal relay |
| `RELAY_SECRET` | Yes (portal mode) | (none) | Shared secret for HA authentication. Must match HA's `portal_secret` |
| `SERVER_PORT` | No | `8080` (portal), `8099` (HA) | HTTP/WebSocket listen port |
| `CORS_ORIGINS` | No | `*` (portal) | Comma-separated allowed origins, or `*` for any |
| `PORTAL_GRACE_PERIOD_MS` | No | `60000` | Milliseconds to wait before disconnecting guests after HA drops |

### HA Add-on Configuration (Home Assistant side)

In the HA add-on options panel:

| Option | Value |
|--------|-------|
| `portal_url` | `wss://portal.yourdomain.com` (or `ws://your-vps-ip:8080` for testing) |
| `portal_secret` | Same value as `RELAY_SECRET` on the portal |

Or via environment variables (standalone Docker mode):

```bash
PORTAL_URL=wss://portal.yourdomain.com
PORTAL_SECRET=same-value-as-relay-secret
```

---

## Generating a Secure Secret

```bash
# Generate a 48-byte hex secret (96 characters)
openssl rand -hex 48

# Or with Python
python3 -c "import secrets; print(secrets.token_hex(48))"

# Or with Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Important**: Use the **same secret** on both the portal (`RELAY_SECRET`) and the HA add-on (`portal_secret`). If they don't match, HA will fail to connect.

---

## HTTPS / TLS Setup

### Option A: Caddy (Recommended - Automatic)

See Docker Compose with Caddy example above. Zero-config TLS.

### Option B: nginx + Let's Encrypt

```nginx
server {
    listen 80;
    server_name portal.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name portal.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/portal.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Critical**: The `Upgrade` and `Connection` headers are required for WebSocket (Socket.IO) to work.

### Option C: Direct Node.js TLS

Not recommended for production. Use a reverse proxy instead.

---

## Monitoring

### Health Check

```bash
# Basic health
curl https://portal.yourdomain.com/api/health

# Response includes:
# - connectedInstances: number of HA instances connected
# - connectedGuests: total guests across all instances
```

### Docker Healthcheck

The Docker Compose example includes a healthcheck. Docker will restart the container if health checks fail 3 times consecutively.

### Log Monitoring

```bash
# Follow logs
docker logs -f playrooms-portal

# Key log lines to watch for:
# [Portal] HA instance registered: ...     (HA connected)
# [Portal] HA instance disconnected: ...   (HA dropped)
# [Portal] Grace period expired: ...       (HA didn't reconnect)
```

### Process Monitoring (systemd)

If running without Docker:

```ini
[Unit]
Description=PlayRoom Portal
After=network.target

[Service]
Type=simple
User=playrooms
WorkingDirectory=/opt/playrooms-portal
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=PORTAL_MODE=true
Environment=RELAY_SECRET=your-secret-here
Environment=SERVER_PORT=8080

[Install]
WantedBy=multi-user.target
```

---

## Firewall Configuration

The portal only needs one port open:

```bash
# UFW (Ubuntu)
ufw allow 80/tcp    # HTTP (for Let's Encrypt + redirect)
ufw allow 443/tcp   # HTTPS + WSS
# OR if no reverse proxy:
ufw allow 8080/tcp  # Direct portal access

# No other ports needed
# The portal does not need to reach back into the user's home network
# HA connects OUTBOUND to the portal
```

---

## Updating

```bash
# Pull new image
docker pull yourusername/playrooms-portal:latest

# Restart
docker compose down
docker compose up -d

# Or with plain Docker
docker stop playrooms-portal
docker rm playrooms-portal
docker run -d ... (same run command as before)
```

The portal is stateless — there's no data to migrate on updates.

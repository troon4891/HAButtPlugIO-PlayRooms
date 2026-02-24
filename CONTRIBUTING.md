# Contributing to ButtPlug.io PlayRooms

Thank you for your interest in contributing. This project is currently in
**beta** and welcomes bug reports, documentation improvements, and code
contributions.

## Reporting Bugs

Please open an issue on GitHub:
https://github.com/troon4891/HAButtPlugIO-PlayRooms/issues

Include:
- Steps to reproduce
- Expected vs. actual behavior
- Your deployment mode (HA add-on or standalone Docker) and version
- Your platform (HA OS, VirtualBox, Proxmox, bare metal, etc.)
- Browser and OS (for client-side issues)

For **security vulnerabilities**, do **not** open a public issue. Follow the
process described in [SECURITY.md](SECURITY.md).

## Branch Strategy

- **`beta`** is the active development branch. All pull requests should
  target `beta`.
- **`main`** receives merges from `beta` when a release is considered stable.

## Pull Request Expectations

1. Fork the repository and create a feature branch from `beta`.
2. Keep changes focused — one logical change per PR.
3. Include a clear description of what the PR does and why.
4. Ensure the Docker image still builds (`docker build buttplug-playrooms/`).
5. If you add or update a dependency, you **must** update
   [NOTICE.md](NOTICE.md) with the package name, version, license, and
   source URL.
6. If you update a platform guide, test the steps on that platform before
   submitting.

## Development Setup

### Option 1: Local Development (without Docker)

```bash
# Clone and enter the repo
git clone https://github.com/troon4891/HAButtPlugIO-PlayRooms.git
cd HAButtPlugIO-PlayRooms/buttplug-playrooms

# Server
cd server && npm install && npm run dev

# Client (separate terminal)
cd client && npm install && npm run dev
```

The server runs on port 8099 and the client dev server proxies API calls to
it. You need a running Intiface Engine instance for device features.

In standalone mode (the default when not running under HA), the server starts
with built-in user accounts. On first launch, visit `http://localhost:8099` to
create your admin account.

### Option 2: Docker Development

```bash
git clone https://github.com/troon4891/HAButtPlugIO-PlayRooms.git
cd HAButtPlugIO-PlayRooms
docker compose up -d --build
```

See the [Platform Guides](docs/) for detailed setup including hardware
passthrough on VirtualBox or Proxmox.

## Code Style

- TypeScript for both server and client
- Server: Express + Socket.IO + Drizzle ORM
- Client: React + Vite + Tailwind CSS
- No linter is configured yet; match existing conventions

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).

## Notable Contributors

The following tools and individuals have made significant contributions to this project outside the standard pull request workflow.

| Name | Type | Links |
|------|------|-------|
| Claude by Anthropic | AI Assistant | [anthropic.com](https://anthropic.com) |

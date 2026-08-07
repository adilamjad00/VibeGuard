# SUPERSEDED — not used by the Zerops deploy. See docs/ARCHITECTURE.md, Phase 1.
#
# Zerops' zerops.yaml has no Dockerfile build path for runtime services, so the
# scanner CLIs are installed via `run.prepareCommands` in zerops.yaml instead
# (which Zerops builds once and caches). This file is kept as the portable
# equivalent: it documents the same install and is the escape hatch if the
# worker ever moves to a `docker@26.1` service or another platform.
#
# Kept in sync with zerops.yaml's prepareCommands — change both together.

FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# semgrep — a venv rather than a bare pip install, because Debian/Ubuntu mark
# the system Python as externally managed (PEP 668) and reject direct installs.
RUN python3 -m venv /opt/semgrep \
    && /opt/semgrep/bin/pip install --no-cache-dir semgrep \
    && ln -sf /opt/semgrep/bin/semgrep /usr/local/bin/semgrep

# gitleaks — static Go binary
ARG GITLEAKS_VERSION=8.30.1
RUN curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
    | tar -xz -C /usr/local/bin gitleaks

# osv-scanner — v2 dropped the version from the asset name
ARG OSV_VERSION=2.5.0
RUN curl -sSfL -o /usr/local/bin/osv-scanner \
      "https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}/osv-scanner_linux_amd64" \
    && chmod +x /usr/local/bin/osv-scanner

WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @vibeguard/core && npm run build -w @vibeguard/worker
CMD ["node", "apps/worker/dist/index.js"]

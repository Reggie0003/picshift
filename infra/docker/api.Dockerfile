# =============================================================================
# Pic Shift API — production container
# =============================================================================
# Multi-stage build: small final image, no source maps, no dev deps.
# Runs as a non-root user with read-only filesystem (see docker-compose.yml).
# =============================================================================

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install OS deps needed by argon2 (libc6) and prisma engines (libssl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=optional --no-audit --no-fund

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ---- final image -----------------------------------------------------------
FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl wget tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 10001 picshift \
    && useradd -u 10001 -g picshift -s /usr/sbin/nologin -d /app picshift

COPY --from=builder --chown=picshift:picshift /app/node_modules ./node_modules
COPY --from=builder --chown=picshift:picshift /app/dist ./dist
COPY --from=builder --chown=picshift:picshift /app/prisma ./prisma
COPY --from=builder --chown=picshift:picshift /app/package.json ./package.json

USER picshift
ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:4000/readyz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]

# syntax=docker/dockerfile:1.7

# ==========================================
# Stage 1: Builder — install deps & build frontend statis
# ==========================================
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

# ==========================================
# Stage 2: Dependensi produksi saja (supabase-js, web-push)
# ==========================================
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# ==========================================
# Stage 3: Runner — image ringan, non-root
# ==========================================
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DIST_DIR=/app/dist

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S bunjs && \
    adduser -S appuser -u 1001 -G bunjs

COPY --from=deps --chown=appuser:bunjs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:bunjs /app/dist ./dist
COPY --chown=appuser:bunjs package.json ./
COPY --chown=appuser:bunjs server ./server
COPY --chown=appuser:bunjs scripts ./scripts

USER appuser
EXPOSE 3000

CMD ["dumb-init", "bun", "server/index.ts"]

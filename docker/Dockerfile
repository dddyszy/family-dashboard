# syntax=docker/dockerfile:1

FROM oven/bun:1 AS build
WORKDIR /app
# Optional npm mirror for slow networks, e.g. https://registry.npmmirror.com
ARG NPM_REGISTRY=
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN if [ -n "$NPM_REGISTRY" ]; then export BUN_CONFIG_REGISTRY="$NPM_REGISTRY"; fi \
  && bun install --frozen-lockfile
COPY . .
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
RUN bun run build

FROM oven/bun:1-alpine AS runtime
WORKDIR /app
ARG NPM_REGISTRY=
ENV NODE_ENV=production \
    PORT=8686 \
    DATA_DIR=/app/data \
    TZ=Asia/Shanghai
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN if [ -n "$NPM_REGISTRY" ]; then export BUN_CONFIG_REGISTRY="$NPM_REGISTRY"; fi \
  && bun install --frozen-lockfile --production \
  && rm -rf /root/.bun/install/cache
COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
COPY apps/server/tsconfig.json apps/server/
COPY tsconfig.base.json ./
COPY --from=build /app/apps/web/dist apps/web/dist
# Runs as root on purpose: NAS bind mounts are owned by the host admin, not uid 1000.
RUN mkdir -p /app/data
EXPOSE 8686
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8686/api/health > /dev/null || exit 1
CMD ["bun", "apps/server/src/index.ts"]

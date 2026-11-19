# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /workspace
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
RUN addgroup -g 10001 fluffy \
    && adduser -D -u 10001 -G fluffy fluffy \
    && mkdir -p /srv /data /config \
    && chown -R 10001:10001 /srv /data /config
COPY --from=build --chown=10001:10001 /workspace/dist/ /srv/
COPY deploy/Caddyfile /etc/caddy/Caddyfile
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

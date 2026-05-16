FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY apps/web ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY infra/docker/web.nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

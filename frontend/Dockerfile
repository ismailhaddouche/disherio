FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build shared package FIRST
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Install frontend dependencies
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build -- --configuration production --output-path=dist/disherio

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist/disherio/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200

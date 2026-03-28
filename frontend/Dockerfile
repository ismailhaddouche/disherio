FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build shared package FIRST (required for npm install)
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Copy frontend package.json and install (shared is now available)
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy rest of frontend
COPY frontend/ .
RUN npm run build -- --configuration production --output-path=dist/disherio

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist/disherio/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200

FROM node:20-alpine AS builder
WORKDIR /app

# Copiar monorepo completo manteniendo estructura
COPY shared ./shared
COPY frontend ./frontend

# Build shared primero
RUN cd shared && npm install && npm run build

# Instalar y compilar frontend (encontrará shared en file:../shared)
RUN cd frontend && npm install --legacy-peer-deps && npm run build -- --configuration production --output-path=dist/disherio

FROM caddy:2-alpine AS runner
COPY --from=builder /app/frontend/dist/disherio/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200

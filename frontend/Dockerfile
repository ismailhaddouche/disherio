FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
WORKDIR /app

# Install the workspace exactly as locked before copying source files.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY shared ./shared
COPY frontend ./frontend
RUN npm run build --workspace=shared && npm run build --workspace=frontend -- --configuration production

FROM caddy:2-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 AS runner
COPY --from=builder /app/frontend/dist/frontend/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200
USER caddy

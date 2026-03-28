FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build shared package first
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Copy frontend package files
COPY frontend/package*.json ./

# Remove @disherio/shared from package.json temporarily and install deps
RUN node -e "const pkg=require('./package.json'); delete pkg.dependencies['@disherio/shared']; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2))" && \
    npm install --legacy-peer-deps

# Manually install the shared package by copying it
RUN mkdir -p node_modules/@disherio/shared && \
    cp -r shared/dist node_modules/@disherio/shared/ && \
    cp shared/package.json node_modules/@disherio/shared/

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build -- --configuration production --output-path=dist/disherio

FROM caddy:2-alpine AS runner
COPY --from=builder /app/dist/disherio/browser /srv
COPY frontend/Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 4200

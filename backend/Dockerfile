# Build stage - full Node image for native dependency compilation (bcrypt)
# Multi-architecture support: amd64, arm64 (Raspberry Pi), armv7l, etc.
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage - slim image for minimal footprint
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:3000/api/health',s=>{process.exit(s.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

# Set timezone support for all architectures
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root user for security
RUN useradd -m -u 1001 appuser || true
USER appuser

CMD ["node", "src/index.js"]

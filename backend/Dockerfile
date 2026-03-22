# Build stage
FROM node:20-slim AS builder
WORKDIR /app
# Essential for native builds if needed in slim (optional but safer)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Set timezone support
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

# Health check using native fetch (Node 20)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run as non-root
RUN useradd -m -u 1001 appuser || true
RUN chown -R appuser:appuser /app
USER appuser

CMD ["node", "src/index.js"]

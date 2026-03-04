# Build stage - Use full Node for building
# Multi-architecture support: amd64, arm64 (Raspberry Pi), armv7l, etc.
FROM node:20-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Production stage - Minimal Nginx
FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html

# Copy built Angular app
COPY --from=build-stage /app/dist/frontend/browser .

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install tzdata for timezone support
RUN apk add --no-cache tzdata ca-certificates

# Create non-root user
RUN addgroup -g 1001 appuser && adduser -D -u 1001 -G appuser appuser

# Change ownership of nginx directories to non-root user
RUN chown -R appuser:appuser /var/log/nginx /var/cache/nginx /etc/nginx && \
    touch /var/run/nginx.pid && \
    chown appuser:appuser /var/run/nginx.pid

USER appuser

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
WORKDIR /app

# Install the workspace exactly as locked before copying source files.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY shared ./shared
COPY backend ./backend
RUN npm run build --workspace=shared && npm run build --workspace=backend

# Copy locales to dist directory (tsc does not copy non-TS files)
RUN cp -r backend/src/locales backend/dist/

FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install tools needed for healthchecks
RUN apk add --no-cache wget curl

# Create non-root user and group (UID/GID 1001)
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nodejs -G nodejs

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --workspace=shared --workspace=backend

COPY --from=builder /app/shared/dist ./shared/dist

# Copy compiled backend
COPY --from=builder /app/backend/dist ./dist

# Create uploads directory and set ownership
RUN mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000
CMD ["node", "dist/index.js"]

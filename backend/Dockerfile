FROM node:20-alpine AS builder
WORKDIR /app

# Copy full monorepo keeping structure
COPY shared ./shared
COPY backend ./backend

# Build shared first
RUN cd shared && npm install && npm run build

# Install and build backend (will find shared at file:../shared)
RUN cd backend && npm install && npm run build

# Copy locales to dist directory (tsc does not copy non-TS files)
RUN cp -r backend/src/locales backend/dist/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install tools needed for healthchecks
RUN apk add --no-cache wget curl

# Copy files needed for production
COPY backend/package*.json ./
# npm creates a symlink node_modules/@disherio/shared -> /shared (system root)
# because file:../shared from /app resolves to /shared.
# We need to break that symlink so the following COPYs create a real directory
# inside /app/node_modules, where Node finds zod via hoisting.
RUN npm install --omit=dev && rm -rf ./node_modules/@disherio/shared

# Copy compiled shared
COPY --from=builder /app/shared/dist ./node_modules/@disherio/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@disherio/shared/package.json

# Copy compiled backend
COPY --from=builder /app/backend/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]

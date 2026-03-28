FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build shared package FIRST (required for npm install)
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Copy backend package.json and install (shared is now available)
COPY backend/package*.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy shared for production
COPY shared ./shared
RUN cd shared && npm install && npm run build

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]

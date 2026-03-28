FROM node:20-alpine AS builder
WORKDIR /app

# Copy and build shared package first
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Copy backend package files
COPY backend/package*.json ./

# Remove @disherio/shared from package.json temporarily and install deps
RUN node -e "const pkg=require('./package.json'); delete pkg.dependencies['@disherio/shared']; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2))" && \
    npm install

# Manually install the shared package by copying it
RUN mkdir -p node_modules/@disherio/shared && \
    cp -r shared/dist node_modules/@disherio/shared/ && \
    cp shared/package.json node_modules/@disherio/shared/

# Copy and build backend source
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy compiled shared package
COPY --from=builder /app/node_modules/@disherio/shared ./node_modules/@disherio/shared

# Copy compiled backend
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]

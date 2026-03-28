FROM node:20-alpine AS builder
WORKDIR /app

# Copiar monorepo completo manteniendo estructura
COPY shared ./shared
COPY backend ./backend

# Build shared primero
RUN cd shared && npm install && npm run build

# Instalar y compilar backend (encontrará shared en file:../shared)
RUN cd backend && npm install && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiar archivos necesarios para producción
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copiar shared compilado
COPY --from=builder /app/shared/dist ./node_modules/@disherio/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@disherio/shared/package.json

# Copiar backend compilado
COPY --from=builder /app/backend/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS builder
WORKDIR /app

# Copiar monorepo completo manteniendo estructura
COPY shared ./shared
COPY backend ./backend

# Build shared primero
RUN cd shared && npm install && npm run build

# Instalar y compilar backend (encontrará shared en file:../shared)
RUN cd backend && npm install && npm run build

# Copiar locales al directorio dist (tsc no copia archivos no-TS)
RUN cp -r backend/src/locales backend/dist/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Instalar herramientas necesarias para healthchecks
RUN apk add --no-cache wget curl

# Copiar archivos necesarios para producción
COPY backend/package*.json ./
# npm crea un symlink node_modules/@disherio/shared -> /shared (raíz del sistema)
# porque file:../shared desde /app resuelve a /shared.
# Hay que romper ese symlink para que los COPY siguientes creen un directorio real
# dentro de /app/node_modules, donde Node sí encuentra zod por hoisting.
RUN npm install --omit=dev && rm -rf ./node_modules/@disherio/shared

# Copiar shared compilado
COPY --from=builder /app/shared/dist ./node_modules/@disherio/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@disherio/shared/package.json

# Copiar backend compilado
COPY --from=builder /app/backend/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]

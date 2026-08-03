# Stage 1: Build frontend
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:24-alpine AS backend-build
RUN apk add --no-cache openssl
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:24-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY backend/prisma ./prisma
COPY backend/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=frontend-build /app/frontend/dist ../frontend/dist

RUN chmod +x ./scripts/docker-entrypoint.sh

CMD ["./scripts/docker-entrypoint.sh"]

# ---- Build React frontend ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Production deps only ----
FROM node:20-slim AS deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ---- Tests (CI builds this target; build fails if tests fail) ----
FROM node:20-slim AS test
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm test

# ---- Final runtime image ----
FROM node:20-slim AS final
ENV NODE_ENV=production PORT=5000 DB_PATH=/data/rental.db STATIC_DIR=/app/public
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ .
COPY --from=frontend /fe/dist ./public
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 5000
CMD ["node", "server.js"]

# ── Stage 1: Build ──────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy all package files (root + workspaces)
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install all deps (including devDependencies for build)
RUN npm ci

# Copy source
COPY . .

# Build client (vite) + server (tsc)
RUN npm run build

# ── Stage 2: Production ────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Copy package files for production install
COPY package.json package-lock.json ./
COPY server/package.json server/

# Install production deps only
RUN npm ci --workspace=server --omit=dev

# Copy built artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/database ./database

EXPOSE 3001

CMD ["node", "server/dist/app.js"]

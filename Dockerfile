# ── Stage 1: Build ──────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Copy workspace + package files
COPY package*.json ./
COPY client/package.json client/
COPY server/package.json server/

# Install all deps (including devDependencies for build)
RUN npm ci --workspaces

# Copy source
COPY . .

# Build client (vite) + server (tsc)
RUN npm run build

# ── Stage 2: Production ────────────────────────────────
FROM node:24-alpine
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/database ./database
COPY --from=builder /app/package*.json ./

# Install production deps only for server
RUN npm ci --workspace=server --omit=dev

EXPOSE 3001

CMD ["node", "server/dist/app.js"]

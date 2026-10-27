# Multi-stage production build for MDM Daily Auto Register
# Stage 1: Build client and server
FROM node:22-slim AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy full application source code
COPY . .

# Run production build
RUN npm run build

# Stage 2: Minimal hardened runtime image
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Run as non-root node user
USER node

# Copy dependencies and build artifacts from builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/server ./server
COPY --chown=node:node --from=builder /app/server.ts ./server.ts
COPY --chown=node:node --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --chown=node:node --from=builder /app/twa-manifest.json ./twa-manifest.json

EXPOSE 8080

CMD ["npm", "start"]

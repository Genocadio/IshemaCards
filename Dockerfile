# ---- Builder stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (use lockfile if present)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm install; else npm install; fi

# Copy source and build
COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# ---- Runtime stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm install --omit=dev; else npm install --omit=dev; fi

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# App listens on PORT (default 8080)
ENV PORT=8010
EXPOSE 8010

# Optional healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c 'wget -qO- http://127.0.0.1:${PORT}/health >/dev/null 2>&1 || exit 1'

CMD ["node", "dist/index.js"]



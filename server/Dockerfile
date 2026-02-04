# rCAPTCHA Server Dockerfile
# Multi-stage build for minimal production image

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build (optional - Bun can run TypeScript directly)
# RUN bun build src/index.ts --outdir ./dist --target bun

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 rcaptcha

# Copy from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

# Set ownership
RUN chown -R rcaptcha:nodejs /app

# Switch to non-root user
USER rcaptcha

# Environment variables
ENV NODE_ENV=production
ENV PORT=9816
ENV CHALLENGE_TIMEOUT_MS=5000
ENV TOKEN_EXPIRY_MS=60000
ENV CORS_ORIGINS=*

# Expose port
EXPOSE 9816

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9816/health || exit 1

# Start server
CMD ["bun", "run", "src/index.ts"]

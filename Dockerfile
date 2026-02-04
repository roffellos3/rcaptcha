# rCAPTCHA Server - Bun Runtime
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY server/package.json server/bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Copy source and run
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY server/src ./src
COPY server/package.json ./

# Railway/Fly.io use PORT env var
ENV PORT=8080
EXPOSE 8080

USER bun
CMD ["bun", "run", "src/index.ts"]

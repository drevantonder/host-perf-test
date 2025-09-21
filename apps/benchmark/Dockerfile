# Base image includes all browsers and deps
FROM mcr.microsoft.com/playwright:v1.55.0-jammy

# Use pnpm (via corepack)
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

WORKDIR /work

# Copy workspace manifests and the benchmark package manifest
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/benchmark/package.json apps/benchmark/package.json

# Install only benchmark package deps (including devDeps for tsx)
RUN pnpm install --frozen-lockfile --filter ./apps/benchmark...

# Copy benchmark source
COPY apps/benchmark apps/benchmark

WORKDIR /work/apps/benchmark
ENV NODE_ENV=production

EXPOSE 8080

# Default command runs the HTTP server; CLI still available via pnpm start
CMD ["pnpm", "start:server"]

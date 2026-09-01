# Stage 1: Builder - Build React application
# Pinned to the *build* platform: this stage only produces static assets in dist/,
# which are identical for every target architecture. Without this, a linux/arm64
# build runs pnpm install + vite build under QEMU emulation and takes ~10x longer.
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

# Set working directory
WORKDIR /app

# Copy root pnpm files (monorepo setup)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY scripts ./scripts

# Copy the workspace package manifest so --frozen-lockfile can resolve the
# apps/web "@genum/placeholders": "workspace:*" link, then the app manifest.
COPY packages/placeholders/package.json ./packages/placeholders/
COPY apps/web/package.json ./apps/web/

# Install all dependencies (including devDependencies for build)
# Use --filter to install only web app dependencies
RUN DOCKER_BUILD=true pnpm install --frozen-lockfile --filter web

# Copy the placeholders package source and build it (dual CJS/ESM output) before
# the app build, since apps/web resolves the package via its "import" condition.
COPY packages/placeholders/ ./packages/placeholders/
RUN pnpm --filter @genum/placeholders run build

# Copy source code and configuration files
COPY apps/web/ ./apps/web/

# Build the application (Vite will embed VITE_* variables at build time)
WORKDIR /app/apps/web
RUN pnpm run build
WORKDIR /app

# Stage 2: Dist - artifact-only stage used by CI to pull the built assets out of
# the image (`--target dist`) for the Sentry source map upload. Keeping it before
# the runtime stage leaves `runtime` last, so a plain `docker build` is unchanged.
FROM scratch AS dist
COPY --from=builder /app/apps/web/dist /

# Stage 3: Runtime - Production image with Nginx
FROM nginx:alpine AS runtime

# Copy built static files from builder stage
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy env.template.js for runtime configuration
# This will be processed by entrypoint.sh to generate env.js
COPY apps/web/public/env.template.js /usr/share/nginx/html/env.template.js

# Copy custom nginx configuration for SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use custom entrypoint to generate env.js at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]


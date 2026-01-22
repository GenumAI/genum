# Stage 1: Builder - Build React application
FROM node:20-alpine AS builder

# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Set working directory
WORKDIR /app

# Copy root pnpm files (monorepo setup)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY scripts ./scripts

# Copy app package.json
COPY apps/web/package.json ./apps/web/

# Install all dependencies (including devDependencies for build)
# Use --filter to install only web app dependencies
RUN DOCKER_BUILD=true pnpm install --frozen-lockfile --filter web

# Copy source code and configuration files
COPY apps/web/ ./apps/web/

# Build the application (Vite will embed VITE_* variables at build time)
WORKDIR /app/apps/web
RUN pnpm run build
WORKDIR /app

# Stage 2: Runtime - Production image with Nginx
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


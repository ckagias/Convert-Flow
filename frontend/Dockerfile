# frontend/Dockerfile
# ─────────────────────────────────────────────────────────────────
#  Multi-stage build for ConvertFlow Frontend
#
#  Stage 1 (builder): Node 20 — installs deps and runs `vite build`
#  Stage 2 (serve):   Nginx alpine — serves the static dist/ folder
#                     and proxies /auth & /files to the backend.
# ─────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first — leverages Docker layer cache.
# npm install only re-runs when package*.json changes.
COPY package.json package-lock.json* ./

# Use --legacy-peer-deps only if needed; clean install otherwise
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source and build
COPY . .
RUN npm run build


# ── Stage 2: Serve ────────────────────────────────────────────────
FROM nginx:1.25-alpine AS serve

# Remove the default config
RUN rm /etc/nginx/conf.d/default.conf

# Our custom config with API proxy rules
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the compiled React app from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Dockerfile
# -----------------------------------------------------------------------------
# Multi-stage build. The same image is used for three roles — API, email
# worker, and (transitively) the seed script — only the CMD/command differs
# per docker-compose service. Keeps one build artifact instead of three.
# -----------------------------------------------------------------------------

# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# ---------- Dependencies ----------
FROM base AS dependencies
RUN npm install --omit=dev

# ---------- Production ----------
FROM base AS production
ENV NODE_ENV=production

COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . .

# Uploads live on a shared volume (see docker-compose.yml) so every scaled
# app replica sees the same files instead of each writing to its own
# container-local disk.
RUN mkdir -p uploads/tasks

EXPOSE 5000

# Basic healthcheck against the existing /health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Default command runs the API; docker-compose.yml overrides this for the
# email-worker service (`command: node workers/email.worker.js`).
CMD ["node", "server.js"]

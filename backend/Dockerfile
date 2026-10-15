FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS dependencies
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS runtime
RUN apk add --no-cache tini tzdata postgresql17-client
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Jakarta
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY supabase/migrations ./supabase/migrations
COPY supabase/seed/0001_rbac_seed.sql ./supabase/seed/0001_rbac_seed.sql
COPY backend/scripts/copy-database.sh ./backend/scripts/copy-database.sh
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/src/server.mjs"]

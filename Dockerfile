FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_URL=file:/data/cizaro.db STORAGE_DIR=/data/storage
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
# Data lives in /data: attach a Railway volume at that path from the dashboard.
EXPOSE 3000
# Create/upgrade tables, make sure the manager account exists, then start.
CMD ["sh", "-c", "npx prisma db push --skip-generate && (node prisma/seed.mjs || true) && node server.js"]

FROM node:24-slim AS deps

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/
COPY packages/api-contract/package.json ./packages/api-contract/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/llm-client/package.json ./packages/llm-client/
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm build

FROM node:24-slim AS runtime

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /app

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules

# Needed by backend config validation
COPY .env.example .env.example

RUN chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const base='http://127.0.0.1:'+(process.env.PORT||3000);fetch(base+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER node

CMD ["node", "apps/backend/dist/main.js"]
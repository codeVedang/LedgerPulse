FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run prisma:generate -w @ledgerpulse/api \
  && npm run build -w @ledgerpulse/domain \
  && npm run build -w @ledgerpulse/contracts \
  && npm run build -w @ledgerpulse/api

FROM node:22-alpine AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN npm ci --omit=dev \
  --workspace @ledgerpulse/api \
  --workspace @ledgerpulse/domain \
  --workspace @ledgerpulse/contracts \
  && npm run prisma:generate -w @ledgerpulse/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:${PATH}"
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
EXPOSE 4000
CMD ["sh", "-c", "cd apps/api && ../../node_modules/.bin/prisma migrate deploy && ../../node_modules/.bin/prisma db seed && node dist/main.js"]

# syntax=docker/dockerfile:1
#
# BMZ Trade Lab API (NestJS). Build with the repository root as the context:
#   docker build -f apps/api/Dockerfile -t bmz-api .
# On Northflank, set the build context to / and the Dockerfile path to
# apps/api/Dockerfile.

FROM node:22-slim AS builder
RUN corepack enable
# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @bmz/api db:generate \
  && pnpm build:packages \
  && pnpm --filter @bmz/api build

FROM node:22-slim AS runner
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# The whole workspace, already installed and built. Keeping node_modules avoids
# a fragile prune of a monorepo with a generated Prisma client.
COPY --from=builder /app ./

EXPOSE 4000
# Apply any pending migrations, then start the server. The host injects PORT.
CMD ["sh", "-c", "pnpm --filter @bmz/api db:deploy && node apps/api/dist/main.js"]

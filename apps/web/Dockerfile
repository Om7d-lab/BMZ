# syntax=docker/dockerfile:1
#
# BMZ Trade Lab web app (Next.js). Build with the repository root as the context:
#   docker build -f apps/web/Dockerfile --build-arg API_ORIGIN=https://api.example.com -t bmz-web .
# On Northflank, set the build context to / and the Dockerfile path to
# apps/web/Dockerfile, and pass API_ORIGIN as a build argument.

FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /app

# The API origin the /api/* rewrite points at. Next bakes rewrite destinations
# at build time, so this must be supplied here as well as at run time.
ARG API_ORIGIN=http://localhost:4000
ENV API_ORIGIN=${API_ORIGIN}

COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm build:packages \
  && pnpm --filter @bmz/web build

FROM node:22-slim AS runner
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3000
# The host injects PORT; server components also read API_ORIGIN at run time, so
# set it on the service as well.
CMD ["sh", "-c", "cd apps/web && pnpm exec next start -p ${PORT:-3000} -H 0.0.0.0"]

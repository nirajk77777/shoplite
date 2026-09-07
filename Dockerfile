# One image, one container: the API process also serves the built storefront and forwards
# /portal to Incident Resolver, so the whole of ShopLite sits behind a single origin with
# no CORS and nothing to keep in sync. See docker-entrypoint.sh for what start-up does.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# The manifests on their own, so editing source does not re-resolve the dependency tree.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Everything installed, because building the storefront needs its devDependencies.
FROM manifests AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @shoplite/web build

# The API's production dependencies alone — what actually ships.
FROM manifests AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter @shoplite/api...

FROM base AS runtime
ENV NODE_ENV=production
# Where the storefront's assets landed below. Setting it is what makes this process serve
# the pages as well as the API; apps/api/src/config.ts explains the two modes.
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV PORT=4000
ENV HOST=0.0.0.0

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node package.json pnpm-workspace.yaml ./
COPY --chown=node:node apps/api ./apps/api
COPY --chown=node:node --from=build /app/apps/web/dist ./apps/web/dist
COPY --chown=node:node docker-entrypoint.sh ./

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]

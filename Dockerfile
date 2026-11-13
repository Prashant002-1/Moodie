# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS build
COPY . .
RUN npm run build && npm run lint

FROM build AS verification
RUN printf 'NODE_ENV=test\nDATABASE_PATH=memory://\nTMDB_API_KEY=\n' > server/.env.test
RUN npm test && npm --workspace server test -- --runInBand && npm run test:production

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace server --include-workspace-root=false

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 NODE_OPTIONS=--max-old-space-size=768
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY server/package.json ./server/package.json
COPY --from=build /app/dist ./dist
COPY database/schema.sql ./database/schema.sql
COPY database/migrations ./database/migrations
COPY certs/rds-global-bundle.pem ./certs/rds-global-bundle.pem
COPY ops/runtime ./ops
USER node
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s --retries=3 CMD ["node", "ops/healthcheck.mjs"]
CMD ["node", "server/dist/index.js"]

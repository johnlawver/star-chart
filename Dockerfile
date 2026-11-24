# Star Chart's production image: the web pages built for release (no development-only pages) and the server.
# Settings come from Doppler: give the container a DOPPLER_TOKEN (a service token for the `prd` config).

FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN STAR_CHART_RELEASE=true npx vite build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4310
# CA certificates so Doppler can reach its API over HTTPS; curl for the host's health check.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=dopplerhq/cli:3 /bin/doppler /usr/local/bin/doppler
COPY package.json package-lock.json ./
# tsx runs the TypeScript server directly, as in development.
RUN npm ci --include=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY tsconfig.json ./
COPY docker/start.sh ./docker/start.sh
USER node
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://127.0.0.1:4310/api/health || exit 1
CMD ["sh", "docker/start.sh"]

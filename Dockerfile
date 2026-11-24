# Multi-stage image for Cloud Run (free-tier friendly: small runtime, scale-to-zero)
# Pin by digest (node:22-bookworm-slim @ 2026-11-11) for supply-chain integrity.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Public Vite client keys (not server secrets) — required at build time for the SPA bundle.
# Must be passed as --build-arg (Secret Manager runtime attach cannot reach the browser JS).
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_RECAPTCHA_SITE_KEY=""
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

# Generate src/vitePublicEnv.generated.ts then build the SPA.
RUN node scripts/write-vite-public-env.mjs && npm run build

FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
# husky is a devDependency; skip prepare so production npm ci does not fail
ENV HUSKY=0

COPY package.json package-lock.json .npmrc ./
# Install app deps, then remove the base image's npm/corepack toolchain so Trivy
# (and the runtime) are not blocked by CVEs in unused package-manager packages.
# .npmrc (legacy-peer-deps) must be present — npm ci validates the full lockfile.
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=build /app/dist ./dist
COPY server.ts ./server.ts
COPY server ./server
# server.ts / server/* import portfolio data + shared utils from src/
COPY src ./src
COPY firebase-applet-config.json ./firebase-applet-config.json

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "server.ts"]

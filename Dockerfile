# Multi-stage image for Cloud Run (free-tier friendly: small runtime, scale-to-zero)
# Pin by digest (node:22-bookworm-slim @ 2026-11-11) for supply-chain integrity.
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public Vite client keys (not server secrets) — required at build time for the SPA bundle.
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_RECAPTCHA_SITE_KEY=""
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

RUN npm run build

FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

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

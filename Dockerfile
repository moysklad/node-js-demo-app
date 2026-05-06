# syntax=docker/dockerfile:1.7

############ deps: ставим все зависимости (включая dev) для сборки ############
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

############ build: компилируем TS + копируем ассеты ############
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY public ./public

RUN npm run build

############ prod-deps: чистим dev-зависимости из уже готового node_modules ############
FROM deps AS prod-deps

RUN npm prune --omit=dev

############ runtime ############
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/tmp/data \
    APP_DB_PATH=/app/tmp/data/app.sqlite

WORKDIR /app

RUN install -d -m 700 -o node -g node /app/tmp/data

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

VOLUME ["/app/tmp/data"]

CMD ["node", "--no-warnings=ExperimentalWarning", "dist/server.js"]

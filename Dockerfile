# syntax=docker/dockerfile:1.7

############ deps: ставим все зависимости (включая dev) для сборки ############
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

############ build: компилируем TS и собираем browser-ассеты через build:assets ############
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

RUN npm run build

############ prod-deps: чистим dev-зависимости из уже готового node_modules ############
FROM deps AS prod-deps

RUN npm prune --omit=dev

############ runtime ############
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN apk add --no-cache libcap \
  && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
  && mkdir -p /app/tmp \
  && chown -R node:node /app
USER node

EXPOSE 80

CMD ["node", "dist/server.js"]

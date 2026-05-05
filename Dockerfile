FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=80 \
    DATA_DIR=/app/tmp/data \
    APP_DB_PATH=/app/tmp/data/app.sqlite

WORKDIR /app

COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist

# Каталог для SQLite/сессий и прочих runtime-данных
RUN mkdir -p /app/tmp/data \
    && apt-get update \
    && apt-get install -y --no-install-recommends libcap2-bin \
    && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
    && apt-get purge -y --auto-remove libcap2-bin \
    && rm -rf /var/lib/apt/lists/* \
    && chmod 700 /app/tmp/data \
    && chown -R node:node /app

USER node

EXPOSE 80

VOLUME ["/app/tmp/data"]

CMD ["node", "--no-warnings=ExperimentalWarning", "dist/server.js"]

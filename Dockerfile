FROM node:20-bullseye-slim

ENV NODE_ENV=production
ENV NODE_OPTIONS=--v8-pool-size=1
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY dist ./dist

EXPOSE 3000

CMD ["node", "server/src/server.js"]

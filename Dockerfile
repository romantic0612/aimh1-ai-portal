FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g pm2@latest

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY dist ./dist
COPY ecosystem.config.cjs ./ecosystem.config.cjs

EXPOSE 7998

CMD ["pm2-runtime", "ecosystem.config.cjs", "--env", "production"]

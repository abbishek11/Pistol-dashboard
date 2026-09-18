FROM node:22-alpine

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev

COPY server/index.js ./
COPY migrations ./migrations

EXPOSE 8080
CMD ["node", "index.js"]

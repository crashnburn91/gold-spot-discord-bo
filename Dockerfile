FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p /app/data

CMD ["node", "src/index.js"]

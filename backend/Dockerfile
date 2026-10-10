# Backend Web HR (Node.js/Express, ESM, không build step — chỉ cần node_modules + source).
FROM node:22-alpine

WORKDIR /app

# npm workspaces: package-lock.json được tạo cho cả monorepo (backend + frontend), nên `npm ci`
# cần đủ cả hai package.json để khớp lockfile — dù image này chỉ chạy backend lúc runtime.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev

COPY backend ./backend
COPY database ./database

WORKDIR /app/backend

EXPOSE 4000

CMD ["node", "src/server.js"]

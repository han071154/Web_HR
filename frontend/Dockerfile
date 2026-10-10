# Build stage: biên dịch React (Vite) thành file tĩnh.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY frontend ./frontend

# VITE_API_URL được nhúng vào bundle lúc build (biến môi trường của Vite chỉ đọc ở build-time).
# Mặc định dùng đường dẫn tương đối "/api" để Nginx tự reverse-proxy sang service backend —
# tránh phải biết trước tên miền/host khi build image.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace frontend

# Serve stage: phục vụ file tĩnh bằng Nginx, proxy /api sang service "backend".
FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

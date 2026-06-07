# ─── Development Stage ────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ─── Builder Stage ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite reads VITE_* env vars at build time and bakes them into the bundle.
# Use a relative `/api` so the SPA hits the nginx proxy in this image.
ARG VITE_API_URL=/api
ARG VITE_APP_NAME=SmartPM
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

RUN npm run build

# ─── Production Stage (Nginx on 3000) ─────────────────────────
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run nginx as non-root user
RUN addgroup -g 1001 -S nginx-app && adduser -S nginx-app -u 1001 -G nginx-app \
  && chown -R nginx-app:nginx-app /usr/share/nginx/html \
  && chown -R nginx-app:nginx-app /var/cache/nginx \
  && chown -R nginx-app:nginx-app /var/log/nginx \
  && touch /var/run/nginx.pid \
  && chown nginx-app:nginx-app /var/run/nginx.pid

USER nginx-app

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

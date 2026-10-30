# Kebun Durian web: build the static app, then serve it with a tiny nginx.
# HTTPS and /api routing are done by the Caddy in front (see DEPLOY.md).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# No .env in the image (see .dockerignore): the app calls /api on its own domain
# and uses the built-in sensor URL. Also runs the typecheck, so a broken build stops here.
RUN npm run build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1

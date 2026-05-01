# ──────────────────────────────────────────────────────
# Stage 1: build estático con Vite
# ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_API_URL se inyecta en build via --build-arg desde Cloud Build
# (las vars VITE_* solo se consumen al construir, quedan inlined en el JS).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
# npm install (no ci) para tolerar pequeñas desincronizaciones de lockfile
# entre la versión de npm que generó el lockfile (windows) y la del builder.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ──────────────────────────────────────────────────────
# Stage 2: nginx sirve los estáticos
# ──────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Plantilla de nginx que respeta $PORT (Cloud Run inyecta uno aleatorio)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copiar el build
COPY --from=builder /app/dist /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080

# nginx 1.25+ procesa /etc/nginx/templates/*.template con envsubst al arrancar
CMD ["nginx", "-g", "daemon off;"]

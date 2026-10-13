# ==============================================================================
# Frontend Mesa de Servicios COAC: imagen de producción
# ==============================================================================
# Etapa 1 compila Angular con Node; etapa 2 sirve solo el resultado con Nginx
# sin privilegios (sin Node, sin node_modules, sin código fuente).
#
#   docker build -t ghcr.io/<usuario>/mesa-servicios-frontend:1.0.0 .
#
# Necesita un contenedor llamado "backend" en la misma red de Docker (nginx.conf
# reenvía /api a http://backend:8080). Ver Backend-Mesa-Servicios/despliegue/.
# No lleva secretos: la configuración de producción (apiUrl '/api') es la misma
# para cualquier dominio.
# ==============================================================================

# ---------- Etapa 1: compilación ----------
FROM node:20-alpine AS compilacion
WORKDIR /fuente

# Primero solo las dependencias: mientras package-lock.json no cambie, Docker
# reutiliza la capa y no reinstala todo.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Configuración "production": environment.prod.ts (apiUrl relativo '/api'),
# hash en los nombres y presupuestos de tamaño. Sale en dist/mesa-ayuda-frontend
# (builder "browser" de angular.json).
RUN npx ng build --configuration production

# ---------- Etapa 2: servidor ----------
# Variante sin privilegios: Nginx corre con el usuario nginx (uid 101) y
# escucha en el 8080 del contenedor.
FROM nginxinc/nginx-unprivileged:1.27-alpine

ARG VERSION=dev
LABEL org.opencontainers.image.title="mesa-servicios-frontend" \
      org.opencontainers.image.description="Mesa de Servicios COAC - frontend Angular servido con Nginx" \
      org.opencontainers.image.source="https://github.com/IsmaelAndra/Frontend-Mesa-Servicios" \
      org.opencontainers.image.version="${VERSION}"

# nginx.conf es una plantilla: la imagen la pasa por envsubst al arrancar y
# deja el resultado en /etc/nginx/conf.d/default.conf.
ENV REAL_IP_FROM=172.16.0.0/12
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=compilacion /fuente/dist/mesa-ayuda-frontend /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/index.html || exit 1

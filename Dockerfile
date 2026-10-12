# ==============================================================================
# Frontend Mesa de Servicios COAC: imagen de producción
# ==============================================================================
# Etapa 1 compila Angular con Node; etapa 2 sirve solo el resultado con Nginx
# (sin Node, sin node_modules, sin código fuente).
#
#   docker build -t mesa-servicios-frontend .
#
# Necesita un contenedor llamado "backend" en la misma red (nginx.conf reenvía
# /api a http://backend:8080). Ver docker-compose.yml en el repo del backend.
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
# hash en los nombres y presupuestos de tamaño.
RUN npx ng build --configuration production

# ---------- Etapa 2: servidor ----------
# Variante sin privilegios: Nginx corre con un usuario normal y escucha en 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /fuente/dist/mesa-ayuda-frontend /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/index.html || exit 1

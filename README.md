# Mesa de Servicios COAC — Frontend

Aplicación web (Angular 17) de la mesa de servicios de la COAC Magisterio de Pichincha: tickets, kanban, chat en tiempo real, calendario, reportes, administración y el constructor visual de automatizaciones.

Consume la API de [Backend-Mesa-Servicios](https://github.com/IsmaelAndra/Backend-Mesa-Servicios).

## Requisitos

- Node 20 o superior
- Google Chrome (para las pruebas)
- El backend en marcha en `http://localhost:8080/api` (desarrollo)

## Desarrollo

```bash
npm ci
npm start              # http://localhost:4200
```

En desarrollo la API se llama en `http://localhost:8080/api` (`src/environments/environment.ts`). En producción la ruta es relativa (`/api`): la web y la API se sirven en el mismo origen.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/mesa-ayuda-frontend` |
| `npm test` | Pruebas (Karma + Chrome sin pantalla) |
| `npx ng test --watch=false` | Pruebas una sola vez, como en CI |
| `npm run lint` | ESLint de TypeScript y plantillas |

## Arquitectura

- Módulos clásicos (`NgModule`) por área en `src/app/modules/`. **Se cargan bajo demanda**: cada área define sus rutas hijas en su `*.routes.ts` y la tabla raíz (`app-routing.module.ts`) solo lleva `loadChildren`. Al añadir una pantalla, se registra en el `*.routes.ts` de su área.
  - Al añadir un área perezosa nueva, hay que registrarla también en `HIJAS_PEREZOSAS` del spec del breadcrumb, que comprueba que cada miga enlazable resuelve a una ruta real.
- El motor de workflows usa componentes standalone (`modules/admin/workflow-*`).
- Servicios, guards e interceptor en `src/app/core/`; interfaces en `src/app/models/`.
- Estilos: Tailwind + daisyUI y PrimeNG. Movimiento: tokens `--ease-out`, `--ease-in-out`, `--ease-drawer` y duraciones `--dur-*` en `src/styles.css`, con respeto a `prefers-reduced-motion`.

## Producción

- **Docker:** `Dockerfile` (compila y sirve con Nginx sin privilegios) y `nginx.conf` (SPA, proxy de `/api`, SSE sin búfer, caché, gzip y cabeceras de seguridad con la CSP de abajo). Se levanta junto al backend con el `docker-compose.yml` de `Backend-Mesa-Servicios/despliegue/` (ver su `INSTALACION.md`).
- `npm run build` genera `dist/mesa-ayuda-frontend`; se sirve como sitio estático con *fallback* a `index.html` (rutas de Angular).
- La API se llama en `/api` (mismo origen): el servidor web debe reenviar `/api` al backend, **sin búfer** para `/api/events` (SSE).
- La aplicación ya es compatible con una CSP estricta (no hay scripts en línea; el tema se aplica desde `assets/tema.js`). Cabecera recomendada en el servidor:

  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```

## Integración continua

`.github/workflows/ci.yml`: lint, pruebas y build de producción en cada push y pull request.

Las convenciones del proyecto están en el `AGENTS.md` de la carpeta de trabajo. El código, los comentarios y los textos están en español.

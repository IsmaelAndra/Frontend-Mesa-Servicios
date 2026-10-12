/**
 * Configuración de PRODUCCIÓN.
 *
 * `apiUrl` es RELATIVO a propósito. Así el mismo build funciona en cualquier
 * dominio o puerto donde se despliegue, sin editar nada: el backend ya publica
 * su API bajo el contexto `/api`.
 *
 * Antes esto valía `http://localhost:8080/api` y, además, angular.json no
 * tenía `fileReplacements`, así que este archivo ni siquiera se usaba: TODOS los builds, incluidos los de producción, se empaquetaban apuntando a
 * localhost. En el navegador del usuario final eso significa que la aplicación
 * pedía la API a su propio ordenador.
 *
 * Si en tu instalación el frontend y la API se sirven en orígenes distintos
 * (p. ej. la web en https://soporte.coac.gob.ec y la API en
 * https://soporte.coac.gob.ec:8443), cambia esta línea por la URL absoluta
 * que te dé el despliegue y añade ese origen en CORS_ORIGINS del backend.
 */
export const environment = {
  production: true,
  apiUrl: '/api'
};

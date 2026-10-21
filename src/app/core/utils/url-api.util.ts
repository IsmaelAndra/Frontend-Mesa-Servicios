import { environment } from '../../../environments/environment';

/**
 * URL lista para un `<img src>` a partir de lo que devuelve el backend.
 *
 * Llegan tres formas: absoluta ("https://..."), relativa a la API
 * ("/uploads/publico/...", la foto de un usuario) o relativa al servidor que ya
 * incluye el contexto ("/api/uploads/...", la marca en producción, donde el
 * backend devuelve rutas relativas). Antes se anteponía `apiUrl` a todo lo que no
 * fuera absoluto, y en producción (`apiUrl` = "/api") la tercera forma quedaba
 * en "/api/api/uploads/..." y la imagen no cargaba (el logo de la página 404).
 */
export function urlDelApi(url?: string | null): string {
  const limpia = (url || '').trim();
  if (!limpia) return '';
  if (/^(https?:|data:|blob:)/i.test(limpia)) return limpia;

  const base = environment.apiUrl.replace(/\/+$/, '');
  // Ruta del contexto de la API ("/api"), tanto si apiUrl es absoluta
  // ("http://localhost:8080/api") como relativa ("/api").
  const contexto = base.replace(/^https?:\/\/[^/]+/i, '');
  if (contexto && (limpia === contexto || limpia.startsWith(contexto + '/'))) {
    // Ya trae el contexto: solo falta el origen de la API (vacío si es relativa).
    return base.slice(0, base.length - contexto.length) + limpia;
  }
  return base + (limpia.startsWith('/') ? limpia : '/' + limpia);
}

import { environment } from '../../../environments/environment';

/**
 * URL absoluta de una foto de usuario.
 *
 * El backend guarda la foto como ruta relativa ("/uploads/publico/avatars/..."),
 * no como URL completa: ponerla tal cual en un `<img>` [src] la resuelve contra
 * el origen del frontend (el puerto 4200 en desarrollo), que no sirve archivos y
 * deja el avatar en blanco. Solo se antepone `apiUrl` cuando no viene absoluta.
 */
export function urlFotoUsuario(photoUrl?: string | null): string | null {
  const url = (photoUrl || '').trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) || url.startsWith('data:')
    ? url
    : `${environment.apiUrl}${url}`;
}

/**
 * Iniciales para el avatar de quien no tiene foto: primera letra del nombre y
 * de la última palabra ("Ismael Andrade" -> "IA"). Sin espacios de por medio se
 * queda con una sola letra, que es lo que corresponde a un nombre único.
 */
export function inicialesDe(nombre?: string | null): string {
  const limpio = (nombre || '').trim();
  if (!limpio) return '?';
  const partes = limpio.split(/\s+/).filter(Boolean);
  const primera = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : '';
  return (primera + ultima).toUpperCase();
}
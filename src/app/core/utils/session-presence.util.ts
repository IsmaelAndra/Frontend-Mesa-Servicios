/** Estado de sesión que devuelve el backend a partir del registro de conexiones SSE. */
export type SessionState = 'EN_LINEA' | 'RECIENTE' | 'DESCONECTADO';

/** Etiquetas y clases de daisyUI para el punto de presencia. */
export const SESION_META: Record<SessionState, { label: string; dot: string; icon: string }> = {
  EN_LINEA: { label: 'En línea', dot: 'bg-success', icon: 'fa-circle' },
  RECIENTE: { label: 'Conectado recientemente', dot: 'bg-warning', icon: 'fa-clock' },
  DESCONECTADO: { label: 'Desconectado', dot: 'bg-error', icon: 'fa-circle-xmark' }
};

const SIN_SESION: SessionState = 'DESCONECTADO';

/**
 * Colores del punto del navbar. Ahí el fondo es la barra azul oscura, así que
 * "conectado" se muestra en blanco con aro verde: se distingue de un vistazo y
 * no se confunde con el ámbar o el rojo de los otros estados.
 *
 * El anillo va aquí y no en la plantilla: si la plantilla pone su propio color
 * de anillo, los dos compiten y gana el que aparezca despues en el CSS
 * generado, no el que se escriba. Con los dos en el mismo sitio no hay ambigüedad.
 */
export const SESION_PUNTO_NAVBAR: Record<SessionState, string> = {
  EN_LINEA: 'bg-white ring-2 ring-success',
  RECIENTE: 'bg-warning ring-2 ring-warning/40',
  DESCONECTADO: 'bg-error ring-2 ring-error/40'
};

/**
 * Normaliza el estado que llega del backend. Si no viene (por ejemplo en un
 * ticket de una caché vieja), se trata como desconectado.
 */
export function normalizarSesion(valor?: string | null): SessionState {
  if (valor === 'EN_LINEA' || valor === 'RECIENTE' || valor === 'DESCONECTADO') {
    return valor;
  }
  return SIN_SESION;
}

/**
 * Estado a partir de la conexión SSE y de lo que dice el backend.
 *
 * Mientras la conexión se está abriendo ("connecting") el punto no se pinta de
 * rojo: el usuario está con la sesión abierta, solo se está haciendo el
 * handshake, y durante ese margen el backend todavía no lo registra como
 * conectado y devuelve DESCONECTADO. Se pintaba rojo y se quedaba así cuando el
 * onopen tardaba, aunque la sesión fuese buena.
 *
 * Cuando ya no hay conexión, manda lo que diga el servidor: RECIENTE para quien
 * acaba de renovar su token, DESCONECTADO para el resto.
 */
export function estadoDesdeConexion(
  sse: 'connecting' | 'connected' | 'closed',
  sessionState?: string | null
): SessionState {
  if (sse === 'connected' || sse === 'connecting') {
    return 'EN_LINEA';
  }
  return normalizarSesion(sessionState);
}

export function metaSesion(estado: SessionState | string | null | undefined) {
  return SESION_META[normalizarSesion(estado)];
}

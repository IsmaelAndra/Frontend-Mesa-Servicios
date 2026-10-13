/**
 * Iconos de Font Awesome por tipo de activo de TI.
 *
 * El tipo viene como texto del backend (`LAPTOP`, `IMPRESORA`...) y no trae
 * icono propio, así que el mapeo vive aquí y se reutiliza en el listado, el
 * formulario, la ficha y los desplegables. Un mapa por componente hacía que los
 * cuatro sitios pintaran cosas distintas para el mismo tipo.
 */
export const TIPOS_ACTIVO: string[] = [
  'LAPTOP',
  'DESKTOP',
  'MONITOR',
  'IMPRESORA',
  'SERVIDOR',
  'SWITCH',
  'ROUTER',
  'ACCESORIO',
  'OTRO'
];

/** Etiquetas legibles; el valor crudo (`EN_REPARACION`) solo aparece en el backend. */
export const ETIQUETA_TIPO_ACTIVO: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  IMPRESORA: 'Impresora',
  SERVIDOR: 'Servidor',
  SWITCH: 'Switch',
  ROUTER: 'Router',
  ACCESORIO: 'Accesorio',
  OTRO: 'Otro'
};

const ICONO_TIPO_ACTIVO: Record<string, string> = {
  LAPTOP: 'fa-solid fa-laptop',
  DESKTOP: 'fa-solid fa-desktop',
  MONITOR: 'fa-solid fa-display',
  IMPRESORA: 'fa-solid fa-print',
  SERVIDOR: 'fa-solid fa-server',
  SWITCH: 'fa-solid fa-network-wired',
  ROUTER: 'fa-solid fa-wifi',
  ACCESORIO: 'fa-solid fa-keyboard',
  OTRO: 'fa-solid fa-box'
};

/** Icono del tipo; un tipo desconocido cae en la caja genérica. */
export function iconoTipoActivo(tipo?: string | null): string {
  return ICONO_TIPO_ACTIVO[(tipo || '').toUpperCase()] ?? ICONO_TIPO_ACTIVO['OTRO'];
}

/**
 * Nombre legible del tipo. Un tipo desconocido se muestra tal cual: puede venir
 * uno nuevo del backend y ocultarlo tras "Otro" haría creer que es un equipo
 * genérico cuando es otra cosa. Solo cuando no hay tipo se pone "Otro".
 */
export function etiquetaTipoActivo(tipo?: string | null): string {
  const clave = (tipo || '').toUpperCase();
  return ETIQUETA_TIPO_ACTIVO[clave] ?? (tipo || 'Otro');
}
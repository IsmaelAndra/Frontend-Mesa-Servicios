/**
 * Escala de prioridad de un área (1 a 10). La misma que valida el backend
 * (AdminService.PRIORIDAD_AREA_MIN/MAX) y la que resume el panel de administración.
 */
export const PRIORIDAD_AREA_MIN = 1;
export const PRIORIDAD_AREA_MAX = 10;

export interface NivelPrioridadArea {
  etiqueta: 'Alta' | 'Media' | 'Baja';
  clase: string;
  icono: string;
}

export function nivelPrioridadArea(n: number | null | undefined): NivelPrioridadArea {
  const v = n ?? PRIORIDAD_AREA_MIN;
  if (v >= 8) return { etiqueta: 'Alta', clase: 'badge-error', icono: 'fa-arrow-trend-up' };
  if (v >= 5) return { etiqueta: 'Media', clase: 'badge-warning', icono: 'fa-arrow-right' };
  return { etiqueta: 'Baja', clase: 'badge-info', icono: 'fa-arrow-trend-down' };
}

/** Opciones 1..10 con su rango, para el select de prioridad. */
export const OPCIONES_PRIORIDAD_AREA = Array.from({ length: PRIORIDAD_AREA_MAX }, (_, i) => {
  const v = i + 1;
  return { valor: v, texto: `${v} · ${nivelPrioridadArea(v).etiqueta}` };
});

/**
 * Estados de un activo y acciones de su historial: etiqueta, icono y color.
 *
 * Antes cada pantalla (listado, formulario, ficha) tenía su propio switch, y la
 * ficha buscaba acciones que el backend nunca envía (CREADO, ASIGNADO...): el
 * historial mostraba el código crudo con un icono genérico.
 */

export const ESTADOS_ACTIVO = ['DISPONIBLE', 'ASIGNADO', 'EN_REPARACION', 'BAJA'] as const;

interface Meta {
  etiqueta: string;
  icono: string;
  color: string;
}

const ESTADO: Record<string, Meta> = {
  DISPONIBLE: { etiqueta: 'Disponible', icono: 'fa-solid fa-circle-check', color: '#059669' },
  ASIGNADO: { etiqueta: 'Asignado', icono: 'fa-solid fa-user-check', color: '#2563EB' },
  EN_REPARACION: { etiqueta: 'En reparación', icono: 'fa-solid fa-screwdriver-wrench', color: '#D97706' },
  BAJA: { etiqueta: 'Dado de baja', icono: 'fa-solid fa-ban', color: '#DC2626' }
};

const ACCION: Record<string, Meta> = {
  ALTA: { etiqueta: 'Alta', icono: 'fa-solid fa-plus', color: '#059669' },
  ASIGNACION: { etiqueta: 'Asignación', icono: 'fa-solid fa-user-plus', color: '#2563EB' },
  REASIGNACION: { etiqueta: 'Reasignación', icono: 'fa-solid fa-right-left', color: '#7C3AED' },
  DEVOLUCION: { etiqueta: 'Devolución', icono: 'fa-solid fa-rotate-left', color: '#0E7490' },
  REPARACION: { etiqueta: 'Enviado a reparación', icono: 'fa-solid fa-screwdriver-wrench', color: '#D97706' },
  FIN_REPARACION: { etiqueta: 'Reparación finalizada', icono: 'fa-solid fa-wrench', color: '#059669' },
  BAJA: { etiqueta: 'Baja', icono: 'fa-solid fa-ban', color: '#DC2626' }
};

const DESCONOCIDO: Meta = { etiqueta: '', icono: 'fa-solid fa-circle-info', color: '#64748B' };

export function metaEstadoActivo(estado?: string | null): Meta {
  const m = ESTADO[(estado || '').toUpperCase()];
  return m ?? { ...DESCONOCIDO, etiqueta: estado || '—' };
}

export function metaAccionActivo(accion?: string | null): Meta {
  const m = ACCION[(accion || '').toUpperCase()];
  return m ?? { ...DESCONOCIDO, etiqueta: accion || '—' };
}

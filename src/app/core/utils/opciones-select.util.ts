import { MasterOption } from '../../modules/shared/components/master-select/master-select.component';

/**
 * Listas fijas de los selects que no vienen de un maestro, con icono y color.
 *
 * Antes eran <select> nativos (sin icono ni color) al lado de los selects de
 * maestros, que sí los tienen: la misma pantalla mezclaba dos diseños. Con
 * esto todos se pintan con app-master-select.
 */

/** Disparadores del motor de automatizaciones (WorkflowTriggerType). */
const DISPARADORES: Record<string, { icon: string; color: string }> = {
  TICKET_CREATED: { icon: 'fa-solid fa-ticket', color: '#2563EB' },
  TICKET_UPDATED: { icon: 'fa-solid fa-pen-to-square', color: '#0E7490' },
  TICKET_ASSIGNED: { icon: 'fa-solid fa-user-check', color: '#7C3AED' },
  TICKET_STATUS_CHANGED: { icon: 'fa-solid fa-arrows-rotate', color: '#0891B2' },
  TICKET_CLOSED: { icon: 'fa-solid fa-lock', color: '#16A34A' },
  TICKET_REOPENED: { icon: 'fa-solid fa-lock-open', color: '#EA580C' },
  TICKET_PRIORITY_CHANGED: { icon: 'fa-solid fa-flag', color: '#D97706' },
  TICKET_CATEGORY_CHANGED: { icon: 'fa-solid fa-tags', color: '#DB2777' },
  SLA_WARNING: { icon: 'fa-regular fa-clock', color: '#D97706' },
  SLA_BREACHED: { icon: 'fa-solid fa-hourglass-end', color: '#DC2626' },
  USER_CREATED: { icon: 'fa-solid fa-user-plus', color: '#0D9488' },
  USER_UPDATED: { icon: 'fa-solid fa-user-pen', color: '#0E7490' },
  USER_DEACTIVATED: { icon: 'fa-solid fa-user-slash', color: '#64748B' },
  SCHEDULED: { icon: 'fa-regular fa-calendar-days', color: '#4F46E5' },
  MANUAL: { icon: 'fa-solid fa-hand-pointer', color: '#475569' },
};

export function opcionDisparador(valor: string, label: string): MasterOption {
  const m = DISPARADORES[valor] ?? { icon: 'fa-solid fa-bolt', color: '#64748B' };
  return { value: valor, label, icon: m.icon, color: m.color };
}

/** Cómo se programa un disparador SCHEDULED. */
export const MODOS_PROGRAMACION: MasterOption[] = [
  { value: 'INTERVALO', label: 'Cada N minutos', icon: 'fa-solid fa-repeat', color: '#2563EB' },
  { value: 'CRON', label: 'Expresión cron', icon: 'fa-solid fa-code', color: '#7C3AED' },
  { value: 'FECHA', label: 'Una sola vez', icon: 'fa-regular fa-calendar-check', color: '#0D9488' },
];

/** Método de asignación de un equipo. */
export const METODOS_ASIGNACION: MasterOption[] = [
  { value: 'ROUND_ROBIN', label: 'Rotativo', icon: 'fa-solid fa-rotate', color: '#2563EB' },
  { value: 'LEAST_ASSIGNED', label: 'Menos asignados', icon: 'fa-solid fa-scale-balanced', color: '#0D9488' },
  { value: 'MANUAL', label: 'Manual', icon: 'fa-solid fa-hand', color: '#D97706' },
];

/** A quién se envía una plantilla de correo. */
export const REGLAS_DESTINATARIO: MasterOption[] = [
  { value: 'DEFAULT', label: 'Quien dispara el evento', icon: 'fa-solid fa-bolt', color: '#64748B' },
  { value: 'SOLICITANTE', label: 'Dueño del ticket (solicitante)', icon: 'fa-regular fa-user', color: '#2563EB' },
  { value: 'AGENTE', label: 'Agente asignado', icon: 'fa-solid fa-headset', color: '#0E7490' },
  { value: 'AMBOS', label: 'Solicitante y agente', icon: 'fa-solid fa-user-group', color: '#7C3AED' },
  { value: 'CUSTOM', label: 'Correo personalizado', icon: 'fa-solid fa-at', color: '#D97706' },
];

/** Tipo (familia) de una plantilla. */
export const TIPOS_PLANTILLA: MasterOption[] = [
  { value: 'TICKET', label: 'Ticket', icon: 'fa-solid fa-ticket', color: '#2563EB' },
  { value: 'RATING', label: 'Calificación', icon: 'fa-solid fa-star', color: '#D97706' },
  { value: 'SLA', label: 'SLA', icon: 'fa-regular fa-clock', color: '#DC2626' },
  { value: 'EVAL', label: 'Evaluación', icon: 'fa-solid fa-chart-line', color: '#7C3AED' },
  { value: 'TASK', label: 'Tarea', icon: 'fa-solid fa-list-check', color: '#0D9488' },
  { value: 'CUENTA', label: 'Cuenta', icon: 'fa-solid fa-user-shield', color: '#475569' },
];

/** Eventos que disparan una plantilla de correo (nombre de la plantilla). */
const EVENTOS_PLANTILLA: Record<string, { icon: string; color: string }> = {
  TICKET_CREADO: { icon: 'fa-solid fa-ticket', color: '#2563EB' },
  TICKET_ASIGNADO: { icon: 'fa-solid fa-user-check', color: '#7C3AED' },
  TICKET_ACTUALIZADO: { icon: 'fa-solid fa-comment-dots', color: '#0E7490' },
  TICKET_RESUELTO: { icon: 'fa-solid fa-circle-check', color: '#16A34A' },
  TICKET_CERRADO: { icon: 'fa-solid fa-lock', color: '#475569' },
  RATING_REQUEST: { icon: 'fa-solid fa-star', color: '#D97706' },
  SLA_WARNING: { icon: 'fa-regular fa-clock', color: '#EA580C' },
  SLA_BREACHED: { icon: 'fa-solid fa-hourglass-end', color: '#DC2626' },
  ESCALATION: { icon: 'fa-solid fa-arrow-trend-up', color: '#DC2626' },
  MONTHLY_EVALUATION: { icon: 'fa-solid fa-chart-line', color: '#7C3AED' },
  TASK_ASIGNADA: { icon: 'fa-solid fa-list-check', color: '#0D9488' },
  CREACION_USUARIO: { icon: 'fa-solid fa-user-plus', color: '#0D9488' },
  RESET_PASSWORD: { icon: 'fa-solid fa-key', color: '#D97706' },
};

export function opcionEventoPlantilla(valor: string, label: string): MasterOption {
  const m = EVENTOS_PLANTILLA[valor] ?? { icon: 'fa-regular fa-envelope', color: '#64748B' };
  return { value: valor, label, detail: valor, icon: m.icon, color: m.color };
}

/** Período de la pantalla de reportes. */
export const PERIODOS_REPORTE: MasterOption[] = [
  { value: 'HOY', label: 'Hoy', icon: 'fa-solid fa-sun', color: '#D97706' },
  { value: 'MES', label: 'Este mes', icon: 'fa-regular fa-calendar', color: '#2563EB' },
  { value: 'ANIO', label: 'Este año', icon: 'fa-solid fa-calendar-days', color: '#7C3AED' },
  { value: 'SEMESTRE', label: 'Últimos 6 meses', icon: 'fa-solid fa-calendar-week', color: '#0E7490' },
  { value: 'PERSONALIZADO', label: 'Rango personalizado', icon: 'fa-solid fa-sliders', color: '#DB2777' },
  { value: 'TODO', label: 'Todo el historial', icon: 'fa-solid fa-infinity', color: '#475569' },
];

/** Orden de las tarjetas de reportes. */
export const ORDEN_REPORTES: MasterOption[] = [
  { value: 'label', label: 'Nombre (A-Z)', icon: 'fa-solid fa-arrow-down-a-z', color: '#2563EB' },
  { value: 'label-desc', label: 'Nombre (Z-A)', icon: 'fa-solid fa-arrow-up-z-a', color: '#7C3AED' },
];

/** Animaciones de la pantalla de carga. */
const ANIMACIONES: Record<string, { icon: string; color: string }> = {
  SPINNER: { icon: 'fa-solid fa-spinner', color: '#2563EB' },
  RING: { icon: 'fa-regular fa-circle', color: '#0E7490' },
  DOTS: { icon: 'fa-solid fa-ellipsis', color: '#7C3AED' },
  BARS: { icon: 'fa-solid fa-bars-progress', color: '#0D9488' },
  BALL: { icon: 'fa-solid fa-basketball', color: '#EA580C' },
  INFINITY: { icon: 'fa-solid fa-infinity', color: '#DB2777' },
  PULSE: { icon: 'fa-solid fa-heart-pulse', color: '#DC2626' },
  NONE: { icon: 'fa-solid fa-ban', color: '#64748B' },
};

export function opcionAnimacion(valor: string, label: string): MasterOption {
  const m = ANIMACIONES[valor] ?? { icon: 'fa-solid fa-spinner', color: '#64748B' };
  return { value: valor, label, icon: m.icon, color: m.color };
}

/** Intervalo de sincronización con Microsoft Graph: más frecuente, más cálido. */
export function opcionIntervalo(minutos: number, label: string): MasterOption {
  const color = minutos <= 15 ? '#DC2626' : minutos <= 60 ? '#D97706' : minutos <= 360 ? '#2563EB' : '#0D9488';
  return { value: minutos, label, icon: 'fa-solid fa-arrows-rotate', color };
}

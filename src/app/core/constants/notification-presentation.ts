/**
 * Icono y color de cada tipo de notificación.
 *
 * Estaban dentro de navbar.component.ts y la página de notificaciones repetía
 * la inicial del asunto en vez de mirar el tipo: el dropdown de la barra y la
 * lista completa se veían distintos para la misma notificación. Aquí hay una
 * sola fuente y las dos pantallas la consumen.
 *
 * Los tipos son los que escribe el backend en la tabla notification. Antes se
 * comparaban contra TICKET, MENTION, SYSTEM, SUCCESS y ERROR, que no existen
 * ahí: todos los tipos reales caían en el default y se veían con el mismo
 * icono y el mismo gris, sin distinguir un escalado de una respuesta nueva.
 */
export const NOTIFICATION_ICONS: Record<string, string> = {
  // Tickets: azul, el color de la aplicacion.
  TICKET: 'fa-solid fa-ticket',
  TICKET_CREADO: 'fa-solid fa-ticket',
  TICKET_ASIGNADO: 'fa-solid fa-user-check',
  TICKET_ACTUALIZADO: 'fa-solid fa-comment-dots',
  TICKET_RESUELTO: 'fa-solid fa-circle-check',
  TICKET_CERRADO: 'fa-solid fa-lock',

  // Conversacion del ticket.
  CHAT_MENSAJE: 'fa-solid fa-comment-dots',

  // Escalados y SLA: rojo, es lo que hay que mirar de inmediato.
  ESCALATION: 'fa-solid fa-arrow-trend-up',
  SLA_WARNING: 'fa-regular fa-clock',
  // El backend escribe SLA_BREACHED (con D). Antes aquí estaba SLA_BREACH, que no
  // coincide con nada de la base, así que estas notificaciones caían al icono y
  // al gris por defecto: justo las que deberían distinguirse más.
  SLA_BREACHED: 'fa-regular fa-clock',

  // El resto.
  RATING_REQUEST: 'fa-solid fa-star',
  MONTHLY_EVALUATION: 'fa-solid fa-chart-line',
  TASK_ASIGNADA: 'fa-solid fa-list-check',
  MENTION: 'fa-solid fa-at',
  SYSTEM: 'fa-solid fa-circle-info',
  SUCCESS: 'fa-solid fa-circle-check',
  ERROR: 'fa-solid fa-triangle-exclamation',
  ALERT: 'fa-solid fa-triangle-exclamation'
};

/** Clases de fondo de daisyUI segun el tipo, para que el avatar sea el color. */
export const NOTIFICATION_COLORS: Record<string, string> = {
  TICKET: 'bg-primary',
  TICKET_CREADO: 'bg-primary',
  TICKET_ASIGNADO: 'bg-primary',
  TICKET_ACTUALIZADO: 'bg-success',
  TICKET_RESUELTO: 'bg-info',
  TICKET_CERRADO: 'bg-info',
  CHAT_MENSAJE: 'bg-success',
  ESCALATION: 'bg-error',
  SLA_WARNING: 'bg-error',
  SLA_BREACHED: 'bg-error',
  RATING_REQUEST: 'bg-warning',
  MONTHLY_EVALUATION: 'bg-secondary',
  TASK_ASIGNADA: 'bg-secondary',
  MENTION: 'bg-info',
  SYSTEM: 'bg-neutral',
  SUCCESS: 'bg-success',
  ERROR: 'bg-error',
  ALERT: 'bg-error'
};

/** Icono del tipo, con la campana para lo que no este contemplatesdo. */
export function notificationIcon(type?: string): string {
  return NOTIFICATION_ICONS[(type || '').toUpperCase()] ?? 'fa-regular fa-bell';
}

/** Clase de fondo del tipo, con un gris neutro para los desconocidos. */
export function notificationColor(type?: string): string {
  return NOTIFICATION_COLORS[(type || '').toUpperCase()] ?? 'bg-neutral';
}

/** Etiqueta legible del tipo, para el title del icono. */
export function notificationLabel(type?: string): string {
  return (type || '').toUpperCase().replace(/_/g, ' ');
}

/**
 * Urgencia de cada tipo, para elegir qué sonido suena al llegar la notificación.
 *
 * Se decide por el tipo y no por el icono ni por el color, porque estos ya
 * expresan "de qué va" y la urgencia es otra cosa: un SLA por vencer no es lo
 * mismo que un mensaje de chat aunque los dos sean informativos.
 *
 * - `urgent`: lo que hay que mirar de inmediato.
 * - `normal`: un aviso de trabajo normal: asignaciones, avances y cierres.
 * - `soft`: el murmullo de fondo: conversación y avisos del sistema.
 *
 * `notificationUrgency` cae en `soft` para los tipos que no estén en la tabla,
 * para que un evento nuevo no se quede sin sonido.
 */
export type NotificationUrgency = 'urgent' | 'normal' | 'soft';

export const NOTIFICATION_URGENCY: Record<string, NotificationUrgency> = {
  // Lo que no puede esperar.
  SLA_BREACHED: 'urgent',
  ESCALATION: 'urgent',
  ERROR: 'urgent',
  ALERT: 'urgent',

  // Avisos de trabajo: asignaciones, avances y cierres.
  TICKET_ASIGNADO: 'normal',
  TICKET_CREADO: 'normal',
  TICKET_ACTUALIZADO: 'normal',
  TICKET_RESUELTO: 'normal',
  TICKET_CERRADO: 'normal',
  TICKET: 'normal',
  TASK_ASIGNADA: 'normal',
  RATING_REQUEST: 'normal',
  MONTHLY_EVALUATION: 'normal',
  MENTION: 'normal',
  // Por vencer todavía no es una urgencia: es un aviso preventivo.
  SLA_WARNING: 'normal',

  // Lo que puede llegar sin que te enteres.
  CHAT_MENSAJE: 'soft',
  SYSTEM: 'soft',
  SUCCESS: 'soft'
};

/** Urgencia de la notificación, con `soft` para los tipos desconocidos. */
export function notificationUrgency(type?: string | null): NotificationUrgency {
  return NOTIFICATION_URGENCY[(type || '').toUpperCase()] ?? 'soft';
}

/**
 * Ruta a la que lleva una notificación que no va sobre un ticket.
 *
 * Las evaluaciones mensuales y las tareas se generan con
 * `sendNotification(null, receptor, ...)`, así que llegan sin `ticketId`. Antes el
 * clic comprobaba `if (n.ticketId)` y no pasaba nada: se marcaba como leída y la
 * lista se quedaba igual, sin explicación de por qué. Ahora cada tipo sin ticket
 * tiene un destino propio.
 *
 * Ojo con `MONTHLY_EVALUATION`: el destinatario es el agente evaluado, pero
 * `/admin/sla-config` está restringida a SUPER_ADMIN, así que un AGENT que la
 * pulse seguirá sin poder abrirla.
 */
export const NOTIFICATION_TARGETS: Record<string, (string | number)[]> = {
  MONTHLY_EVALUATION: ['/admin/sla-config'],
  TASK_ASIGNADA: ['/dashboard']
};

/**
 * Destino de una notificación, o `null` si no hay a dónde ir.
 *
 * El ticket manda sobre el tipo: una notificación de chat sobre el ticket #7
 * debe abrir el ticket, no la pantalla de tareas. Solo cuando no hay ticket se
 * usa la tabla de destinos por tipo.
 */
export function notificationTarget(notification: {
  ticketId?: string | null;
  typeNotification?: string;
}): (string | number)[] | null {
  const ticketId = notification.ticketId;
  if (typeof ticketId === 'string' && ticketId.trim() !== '') {
    return ['/tickets', ticketId];
  }
  return NOTIFICATION_TARGETS[(notification.typeNotification || '').toUpperCase()] ?? null;
}
/**
 * Iconos de navegacion, en un unico sitio.
 *
 * Antes cada componente tenia su propia tabla y se desincronizaron: el
 * breadcrumb usaba 'fa-tag' para tipos de ticket donde el sidebar usa 'fa-tags',
 * y 'fa-chart-column' para reportes donde el sidebar usa 'fa-flask'. Arranca
 * con cinco rutas nuevas sin icono y caian en el icono de carpeta.
 *
 * Ahora ambos consumen este mapa, asi que no pueden divergir: si se anade una
 * ruta al menu, el icono ya esta aqui.
 *
 * El breadcrumb anteponia el prefijo 'pi' de PrimeIcons a clases de Font
 * Awesome, con lo que el glifo nunca se dibujaba. Por eso el mapa guarda solo
 * las clases de Font Awesome, sin el prefijo 'fa-solid' separado: el componente
 * lo aplica tal cual, como hace el sidebar.
 */
export const NAV_ICONS: Record<string, string> = {
  // Principales
  dashboard: 'fa-solid fa-house',
  tickets: 'fa-solid fa-ticket',
  new: 'fa-solid fa-plus',
  mine: 'fa-solid fa-inbox',
  assigned: 'fa-solid fa-user-check',
  kanban: 'fa-solid fa-table-cells-large',
  activities: 'fa-solid fa-table-cells-large',
  calendar: 'fa-regular fa-calendar',
  // Inventario de activos de TI. La clave coincide con el segmento "activos",
  // asi que sidebar y breadcrumb comparten icono.
  activos: 'fa-solid fa-laptop',

  // Administracion
  admin: 'fa-solid fa-user-tie',
  'admin-panel': 'fa-solid fa-chart-line',
  users: 'fa-solid fa-users',
  teams: 'fa-solid fa-diagram-project',
  areas: 'fa-solid fa-building',
  // Sedes: el breadcrumb resuelve por el segmento "sucursales".
  sucursales: 'fa-solid fa-location-dot',
  // Auditoria del sistema (segmento "audit-sistema", sin item de menu).
  'audit-sistema': 'fa-solid fa-clipboard-list',
  'pages-system': 'fa-solid fa-file-shield',
  // La activacion del doble factor, para el super administrador.
  mfa: 'fa-solid fa-shield-halved',
  categories: 'fa-solid fa-tags',
  'ticket-types': 'fa-solid fa-tags',
  sla: 'fa-regular fa-clock',
  'sla-evaluations': 'fa-solid fa-chart-simple',
  // El breadcrumb resuelve por el segmento de la ruta, que aqui es
  // "sla-config". Sin esta clave caia en el icono de carpeta.
  'sla-config': 'fa-solid fa-chart-simple',
  escalations: 'fa-solid fa-arrow-trend-up',
  templates: 'fa-solid fa-file-pen',
  branding: 'fa-solid fa-palette',
  'ai-config': 'fa-solid fa-bolt',
  'microsoft-graph': 'fa-solid fa-share-nodes',
  telefonia: 'fa-solid fa-phone-volume',
  'session-config': 'fa-solid fa-shield-halved',
  'chat-config': 'fa-solid fa-check-double',
  'mail-outbox': 'fa-solid fa-paper-plane',
  mantenimiento: 'fa-solid fa-screwdriver-wrench',
  reports: 'fa-solid fa-chart-column',
  // /admin/reports es la gestion de plantillas de reporte, no la pantalla de
  // reportes. El breadcrumb ve el segmento "reports" con su contexto: bajo
  // "/admin" usa esta clave, y suelto (pagina propia) usa la de arriba.
  'report-templates': 'fa-solid fa-flask',
  // Motor de workflows. La clave coincide con el segmento de ruta, asi que el
  // breadcrumb muestra el mismo icono que el menu.
  workflows: 'fa-solid fa-diagram-project',
  aprobaciones: 'fa-solid fa-user-check',
  notifications: 'fa-regular fa-bell',
  // Historial de ejecuciones (/workflows/ejecuciones): el segmento es
  // "ejecuciones", con lo que el breadcrumb resuelve aqui.
  ejecuciones: 'fa-solid fa-clock-rotate-left',
  // Pagina intermedia del builder (/workflows/:id/editar).
  editar: 'fa-solid fa-pen',

  // Cuenta
  settings: 'fa-solid fa-gear',
  profile: 'fa-regular fa-user',
  password: 'fa-solid fa-lock',
  sounds: 'fa-solid fa-music',

  // Politica de privacidad y pantallas de error, que si llevan breadcrumb
  // (solo /auth/* se queda sin layout).
  privacidad: 'fa-solid fa-user-shield',
  '404': 'fa-solid fa-circle-question',
  '403': 'fa-solid fa-lock',
  '500': 'fa-solid fa-bug',
  '503': 'fa-solid fa-screwdriver-wrench'
};

/** Icono de un segmento de ruta, con reserva para lo que no este en el mapa. */
export function navIcon(segment: string): string {
  return NAV_ICONS[segment] ?? 'fa-solid fa-folder';
}
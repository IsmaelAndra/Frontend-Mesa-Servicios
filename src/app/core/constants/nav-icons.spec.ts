import { NAV_ICONS, navIcon } from './nav-icons';

/**
 * Iconos de navegación.
 *
 * El sidebar y el breadcrumb consumen este mismo mapa, así que una ruta que
 * esté en el menú y no en el mapa sale con el icono de carpeta. Estas pruebas
 * atan los dos extremos para que no vuelva a pasar.
 */
describe('nav-icons', () => {
  /**
   * Rutas del sidebar con su etiqueta. La clave es el segmento con el que se
   * llega a la pantalla desde el menú.
   */
  const RUTAS_MENU: [string, string][] = [
    ['dashboard', 'Inicio'],
    ['kanban', 'Tablero de Tickets'],
    ['mine', 'Mis Tickets'],
    ['admin', 'Administración'],
    ['admin-panel', 'Panel'],
    ['users', 'Usuarios'],
    ['teams', 'Equipos'],
    ['areas', 'Áreas'],
    ['categories', 'Categorías'],
    ['sla', 'SLA'],
    ['sla-evaluations', 'Evaluaciones Mensuales'],
    ['escalations', 'Escalaciones'],
    ['templates', 'Plantillas'],
    ['branding', 'Configuración de Marca'],
    ['pages-system', 'Páginas del Sistema'],
    ['mfa', 'Autenticación MFA'],
    ['ai-config', 'Inteligencia Artificial'],
    ['microsoft-graph', 'Microsoft Graph y Correo'],
    ['session-config', 'Seguridad de Sesión'],
    ['chat-config', 'Acuses de Lectura'],
    ['mail-outbox', 'Cola de correo'],
    ['report-templates', 'Reportes Personalizados'],
    ['activities', 'Actividades'],
    ['calendar', 'Calendario'],
    ['reports', 'Reportes'],
    ['settings', 'Configuración'],
    ['profile', 'Mi Perfil'],
    ['password', 'Cambiar Contraseña'],
    ['sounds', 'Sonidos de Notificaciones']
  ];

  it('todas las rutas del menu tienen icono propio', () => {
    RUTAS_MENU.forEach(([clave]) => {
      expect(navIcon(clave))
        .withContext(`falta el icono de ${clave}`)
        .not.toBe('fa-solid fa-folder');
    });
  });

  it('traen las clases completas de Font Awesome', () => {
    Object.entries(NAV_ICONS).forEach(([clave, icono]) => {
      expect(icono)
        .withContext(`el icono de ${clave} debe incluir la clase de estilo`)
        .toMatch(/^fa-(solid|regular|brands)\s+fa-/);
    });
  });

  it('ningun icono arrastra el prefijo pi de PrimeIcons', () => {
    // El breadcrumb anteponia 'pi' a clases de Font Awesome, y el glifo no se
    // dibujaba nunca. Aquí no puede volver a colarse un 'pi'.
    Object.values(NAV_ICONS).forEach(icono => {
      expect(icono.startsWith('pi')).toBe(false);
    });
  });

  it('resuelve el segmento de las evaluaciones mensuales', () => {
    // El breadcrumb ve el segmento "sla-config" de la ruta, no la clave del
    // menú. Con una y no la otra, salía el icono de carpeta.
    expect(navIcon('sla-config')).toBe('fa-solid fa-chart-simple');
  });

  it('usa una reserva de carpeta para lo que no este en el mapa', () => {
    expect(navIcon('ruta-inventada')).toBe('fa-solid fa-folder');
    expect(navIcon('')).toBe('fa-solid fa-folder');
  });

  it('distingue el tipo de ticket del de las áreas', () => {
    // Antes ambos eran 'fa-tags' en un sitio y 'fa-tag' en otro.
    expect(navIcon('categories')).not.toBe(navIcon('areas'));
  });
});
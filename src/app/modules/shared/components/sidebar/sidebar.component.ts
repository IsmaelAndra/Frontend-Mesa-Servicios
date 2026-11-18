import { esPantallaPequena, esSoloEscritorio } from '../../../../core/guards/solo-escritorio.guard';
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../../../core/services/admin.service';
import { SseService } from '../../../../core/services/sse.service';
import { User } from '../../../../models/user.model';
import { navIcon } from '../../../../core/constants/nav-icons';
import { GlobalSearchService } from '../../../../core/services/global-search.service';
import { metaSesion, normalizarSesion, SessionState } from '../../../../core/utils/session-presence.util';
import { urlDelApi } from '../../../../core/utils/url-api.util';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
  /** Ancla dentro de la ruta, para abrir una seccion especifica. */
  fragment?: string;
  /** Parametros de consulta, para abrir la pestana correcta de una pantalla. */
  queryParams?: Record<string, string>;
  children?: NavItem[];
  expanded?: boolean;
  /** Título del grupo dentro del submenú (solo hijos). */
  grupo?: string;
  /** Sección del menú en la que va (solo los de primer nivel). */
  seccion?: 'principal' | 'trabajo' | 'gestion' | 'cuenta';
}

/** Títulos de las secciones del menú, en el orden en que se pintan. */
const SECCIONES: { id: NonNullable<NavItem['seccion']>; titulo: string }[] = [
  { id: 'principal', titulo: 'Principal' },
  { id: 'trabajo', titulo: 'Trabajo' },
  { id: 'gestion', titulo: 'Gestión' },
  { id: 'cuenta', titulo: 'Cuenta' },
];

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  role = '';
  /** En el teléfono el menú arranca cerrado: abierto tapaba toda la pantalla al cargar. */
  isOpen = typeof window === 'undefined' || window.innerWidth >= 768;
  isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  /** Activa las transiciones del menú tras el primer pintado (ver sidebar.component.css). */
  listo = false;
  /**
   * Contraído o completo, recordado entre recargas y sesiones (localStorage).
   * Antes cada recarga volvía al menú completo aunque se hubiera contraído.
   */
  collapsed = SidebarComponent.leerContraido();
  currentRoute = '';
  logoUrl = '';
  iconUrl = '';
  user: User | null = null;
  sseStatus: 'connecting' | 'connected' | 'closed' = 'closed';
  private sseSub?: Subscription;
  navItems: NavItem[] = [
    {
      label: 'Inicio',
      seccion: 'principal',
      route: '/inicio',
      icon: navIcon('dashboard'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR']
    },
    {
      label: 'Tablero de Tickets',
      seccion: 'principal',
      route: '/tickets/tablero',
      icon: navIcon('kanban'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'AUDITOR']
    },
    {
      label: 'Mis Tickets',
      seccion: 'principal',
      route: '/tickets/mios',
      icon: navIcon('mine'),
      roles: ['USER']
    },
    {
      // Inventario: Tecnología y Desarrollo (GESTOR_ACTIVOS, permiso del
      // servidor), el súper admin y el auditor (solo lee).
      label: 'Activos de TI',
      seccion: 'principal',
      route: '/activos',
      icon: navIcon('activos'),
      roles: ['SUPER_ADMIN', 'GESTOR_ACTIVOS', 'AUDITOR']
    },
    {
      // Cada persona ve sus equipos y acepta sus actas de entrega.
      label: 'Mis equipos',
      seccion: 'principal',
      route: '/activos/mis-equipos',
      icon: navIcon('mis-equipos'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR']
    },
    {
      label: 'Administración',
      seccion: 'gestion',
      route: '/administracion',
      icon: navIcon('admin'),
      roles: ['SUPER_ADMIN', 'GESTOR_USUARIOS', 'AUDITOR', 'AREA_MANAGER', 'CONFIG_ACTIVOS'],
      children: [
        { label: 'Panel', route: '/administracion', icon: navIcon('admin-panel'), roles: ['SUPER_ADMIN'] },
        // Agrupados por tema (el submenú pinta el título del grupo).
        { grupo: 'Personas y estructura', label: 'Usuarios', route: '/administracion/usuarios', icon: navIcon('users'), roles: ['SUPER_ADMIN', 'GESTOR_USUARIOS', 'AUDITOR'] },
        { grupo: 'Personas y estructura', label: 'Áreas', route: '/administracion/areas', icon: navIcon('areas'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Personas y estructura', label: 'Sucursales', route: '/administracion/sucursales', icon: navIcon('sucursales'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Personas y estructura', label: 'Equipos de atención', route: '/administracion/equipos', icon: navIcon('teams'), roles: ['SUPER_ADMIN', 'AREA_MANAGER'] },
        // Las escalaciones son una pestaña de SLA (antes también había un ítem suelto).
        { grupo: 'Atención de tickets', label: 'Categorías', route: '/administracion/categorias', icon: navIcon('categories'), roles: ['SUPER_ADMIN', 'AREA_MANAGER'] },
        { grupo: 'Atención de tickets', label: 'Tipos de ticket', route: '/administracion/tipos-ticket', icon: navIcon('ticket-types'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Atención de tickets', label: 'SLA y escalaciones', route: '/administracion/sla', icon: navIcon('sla'), roles: ['SUPER_ADMIN', 'AREA_MANAGER'] },
        { grupo: 'Atención de tickets', label: 'Evaluaciones mensuales', route: '/administracion/evaluaciones', icon: navIcon('sla-evaluations'), roles: ['SUPER_ADMIN', 'AREA_MANAGER'] },
        { grupo: 'Atención de tickets', label: 'Acuses de lectura', route: '/administracion/acuses-lectura', icon: navIcon('chat-config'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Correos y avisos', label: 'Plantillas', route: '/administracion/plantillas', icon: navIcon('templates'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Correos y avisos', label: 'Plantillas por área', route: '/administracion/plantillas-area', icon: navIcon('plantillas-area'), roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AUDITOR'] },
        { grupo: 'Correos y avisos', label: 'Microsoft Graph y correo', route: '/administracion/correo-microsoft', icon: navIcon('microsoft-graph'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Correos y avisos', label: 'Cola de correo', route: '/administracion/cola-correo', icon: navIcon('mail-outbox'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Apariencia', label: 'Marca', route: '/administracion/marca', icon: navIcon('branding'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Apariencia', label: 'Temas de temporada', route: '/administracion/temas-temporada', icon: navIcon('temas-temporada'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Apariencia', label: 'Páginas del sistema', route: '/administracion/paginas-sistema', icon: navIcon('pages-system'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Seguridad', label: 'Autenticación MFA', route: '/administracion/mfa', icon: navIcon('mfa'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Seguridad', label: 'Seguridad de sesión', route: '/administracion/seguridad-sesion', icon: navIcon('session-config'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Seguridad', label: 'Auditoría del sistema', route: '/administracion/auditoria', icon: navIcon('audit-sistema'), roles: ['SUPER_ADMIN', 'AUDITOR'] },
        // Programar una automatizacion es escribir codigo con permisos ajenos: solo SUPER_ADMIN.
        { grupo: 'Integraciones', label: 'Inteligencia artificial', route: '/administracion/inteligencia-artificial', icon: navIcon('ai-config'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Integraciones', label: 'Telefonía', route: '/administracion/telefonia', icon: navIcon('telefonia'), roles: ['SUPER_ADMIN'] },
        { grupo: 'Integraciones', label: 'Automatizaciones', route: '/automatizaciones', icon: navIcon('workflows'), roles: ['SUPER_ADMIN'] },
        // Maestros de activos: Tecnología y Desarrollo (GESTOR_ACTIVOS) y el súper admin.
        { grupo: 'Activos', label: 'Configuración de activos', route: '/activos/configuracion', icon: navIcon('configuracion'), roles: ['SUPER_ADMIN', 'CONFIG_ACTIVOS'] }
      ]
    },
    {
      // Pasos de las automatizaciones que esperan una decisión: el SUPER_ADMIN
      // decide y el ADMIN sigue sus solicitudes. Nadie más entra.
      label: 'Aprobaciones',
      seccion: 'principal',
      route: '/aprobaciones',
      icon: navIcon('aprobaciones'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER']
    },
    {
      label: 'Actividades',
      seccion: 'trabajo',
      route: '/actividades',
      icon: navIcon('kanban'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR']
    },
    {
      label: 'Proyectos',
      seccion: 'trabajo',
      route: '/proyectos',
      icon: navIcon('proyectos'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR']
    },
    {
      label: 'Calendario',
      seccion: 'trabajo',
      route: '/calendario',
      icon: navIcon('calendar'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR']
    },
    {
      label: 'Reportes',
      seccion: 'trabajo',
      route: '/reportes',
      icon: navIcon('reports'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AUDITOR']
    },
    {
      label: 'Configuración',
      seccion: 'cuenta',
      route: '/mi-cuenta',
      icon: navIcon('settings'),
      roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'],
      children: [
        { label: 'Mi Perfil', route: '/mi-cuenta/perfil', icon: navIcon('profile'), roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] },
        { label: 'Cambiar Contraseña', route: '/mi-cuenta/contrasena', icon: navIcon('password'), roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] },
        { label: 'Sonidos de Notificaciones', route: '/mi-cuenta/sonidos', icon: navIcon('sounds'), roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] },
        { label: 'Dispositivos', route: '/mi-cuenta/dispositivos', icon: navIcon('devices'), roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] }
      ]
    }
  ];

  private static readonly CLAVE_CONTRAIDO = 'sidebarContraido';

  private static leerContraido(): boolean {
    try {
      return localStorage.getItem(SidebarComponent.CLAVE_CONTRAIDO) === '1';
    } catch {
      return false;
    }
  }

  constructor(
    public authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private sseService: SseService,
    private globalSearch: GlobalSearchService
  ) {}

  /** Secciones con al menos un elemento visible para el rol, con sus elementos. */
  get secciones(): { id: string; titulo: string; items: NavItem[] }[] {
    return SECCIONES
      .map((sec) => ({
        ...sec,
        items: this.navItems.filter((i) => i.seccion === sec.id && this.isVisible(i)
          && (!i.children || this.hasVisibleChildren(i))),
      }))
      .filter((sec) => sec.items.length > 0);
  }

  get contraido(): boolean {
    return !this.isMobile && this.collapsed;
  }

  abrirBusqueda(): void {
    this.globalSearch.open();
  }

  /**
   * Sin esto el menú entero se destruía y se volvía a crear en cada ciclo de
   * detección de cambios (el getter `secciones` devuelve objetos nuevos), es
   * decir, cada segundo con el reloj de sesión del navbar. Un clic que caía
   * entre el mousedown y el mouseup acababa en un enlace ya desaparecido y no
   * navegaba: "el sidebar no redirige".
   */
  trackSeccion(_: number, sec: { id: string }): string {
    return sec.id;
  }

  trackItem(_: number, item: NavItem): string {
    return item.route + (item.label ?? '');
  }

  ngOnInit(): void {
    // Tras pintar el estado inicial ya puede animar (setTimeout y no
    // requestAnimationFrame: este no corre en una pestaña en segundo plano).
    setTimeout(() => (this.listo = true), 80);
    this.role = this.authService.getRole();
    this.authService.cargarPermisos();
    // La ruta de entrada también cuenta: el menú solo se enteraba en la
    // siguiente navegación y, al abrir una página directamente, nada salía activo.
    this.currentRoute = this.router.url;
    this.expandirGrupoActivo();
    this.loadLogo();
    this.loadUser();
    this.checkScreenSize();
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoute = event.url;
        this.grupoFlotante = null;
        this.flotante = null;
        this.role = this.authService.getRole();
    this.authService.cargarPermisos();
        this.expandirGrupoActivo();
        if (this.isMobile) this.isOpen = false;
      }
    });

    // El punto de presencia se apoya en el SSE, igual que el navbar. El
    // sessionState que trae /users/me se pide antes de abrir la conexión, asi
    // que sin esto se quedaba en "reciente" aunque el usuario siguiera en linea.
    this.sseSub = this.sseService.status$.subscribe((estado) => {
      const antes = this.sseStatus;
      this.sseStatus = estado;
      if (estado === 'connected' && antes !== 'connected') {
        this.loadUser();
      }
    });
  }

  /** El grupo de la página abierta se despliega solo, para ver dónde se está. */
  private expandirGrupoActivo(): void {
    this.navItems.forEach((i) => {
      if (i.children && this.hasActiveChild(i)) i.expanded = true;
    });
  }

  ngOnDestroy(): void {
    this.sseSub?.unsubscribe();
  }

  loadLogo(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => {
        this.logoUrl = b.logoUrl || '';
        this.iconUrl = b.systemIconUrl || '';
      },
      error: () => {
        this.logoUrl = '';
        this.iconUrl = '';
      }
    });
  }

  loadUser(): void {
    this.authService.me().subscribe({
      next: (u) => (this.user = u),
      error: () => (this.user = null)
    });
  }

  /** URL absoluta de la foto de perfil del usuario, o null si no tiene. */
  get photoSrc(): string | null {
    if (!this.user?.photoUrl) return null;
    if (/^https?:\/\//i.test(this.user.photoUrl)) return this.user.photoUrl;
    return urlDelApi(this.user.photoUrl);
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return this.authService.getEmail() || 'Usuario';
    if (u.displayName) return u.displayName;
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return full || u.corporateEmailUser || this.authService.getEmail();
  }

  /**
   * Estado de presencia mostrado. Con el SSE abierto el usuario está en línea
   * por definición: el sessionState del perfil llega cacheado de antes de la
   * conexión y sin esto se veía "conectado recientemente" en ámbar.
   */
  private get sesionEstado(): SessionState {
    if (this.sseStatus === 'connected') return 'EN_LINEA';
    return normalizarSesion(this.user?.sessionState);
  }

  /** Punto de presencia sobre la foto: verde conectado, ámbar reciente, rojo desconectado. */
  get sesionDot(): string {
    return metaSesion(this.sesionEstado).dot;
  }

  get sesionLabel(): string {
    return metaSesion(this.sesionEstado).label;
  }

  @HostListener('window:resize')
  checkScreenSize(): void {
    const eraMovil = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    if (!this.isMobile) this.isOpen = true;
    // Al pasar a teléfono (girar la tableta, achicar la ventana) se cierra.
    else if (!eraMovil) this.isOpen = false;
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isOpen = !this.isOpen;
    } else {
      this.collapsed = !this.collapsed;
      try {
        localStorage.setItem(SidebarComponent.CLAVE_CONTRAIDO, this.collapsed ? '1' : '0');
      } catch {
        // Sin almacenamiento (modo privado): se recuerda solo en esta página.
      }
      this.grupoFlotante = null;
      this.flotante = null;
    }
  }

  /**
   * Con el menú contraído, un grupo (Administración, Configuración) abre sus
   * páginas en un menú flotante a la derecha. Antes expandía el menú entero,
   * lo que movía todo el contenido de la página para elegir una opción.
   */
  toggleChild(item: NavItem, ev?: Event): void {
    if (this.contraido) {
      this.flotante = null;
      if (this.grupoFlotante?.item === item) {
        this.grupoFlotante = null;
        return;
      }
      const rect = (ev?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
      const hijos = (item.children ?? []).filter((c) => this.isVisible(c)).length;
      // Alto aproximado (título + filas) para que no se salga por abajo.
      const alto = 52 + hijos * 38;
      const top = Math.max(8, Math.min(rect ? rect.top : 80, window.innerHeight - alto - 8));
      this.grupoFlotante = { item, top, left: rect ? rect.right + 10 : 86 };
      return;
    }
    item.expanded = !item.expanded;
  }

  /** Etiqueta que se ve al pasar por un icono con el menú contraído. */
  flotante: { texto: string; top: number; left: number } | null = null;
  /** Grupo abierto como menú flotante, con el menú contraído. */
  grupoFlotante: { item: NavItem; top: number; left: number } | null = null;

  /** `siempre`: también con el menú abierto (el botón de salir es solo un icono). */
  mostrarEtiqueta(ev: Event, texto: string, siempre = false): void {
    if ((!this.contraido && !siempre) || this.grupoFlotante) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.flotante = { texto, top: rect.top + rect.height / 2, left: rect.right + 10 };
  }

  ocultarEtiqueta(): void {
    this.flotante = null;
  }

  cerrarGrupoFlotante(): void {
    this.grupoFlotante = null;
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    this.grupoFlotante = null;
    this.flotante = null;
  }

  /** Un clic fuera del menú flotante (y fuera de su botón) lo cierra. */
  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(ev: MouseEvent): void {
    if (!this.grupoFlotante) return;
    const destino = ev.target as HTMLElement | null;
    if (destino?.closest('.sb-flyout') || destino?.closest('.sb__link--flotante-abierto')) return;
    this.grupoFlotante = null;
  }

  isVisible(item: NavItem): boolean {
    // En el teléfono no se ofrecen las pantallas de solo computador.
    if (esPantallaPequena() && esSoloEscritorio(item.route)) return false;
    const mios = this.authService.rolesEfectivos();
    return item.roles.some((r) => mios.includes(r));
  }

  /**
   * Título que va antes de este hijo: el de su grupo, solo si es el primer hijo
   * visible de ese grupo (con los permisos de quien mira, algunos grupos quedan vacíos).
   */
  tituloDeGrupo(item: NavItem, child: NavItem): string | null {
    if (!child.grupo || !this.isVisible(child)) return null;
    const visibles = (item.children || []).filter((c) => this.isVisible(c));
    const i = visibles.indexOf(child);
    return i === 0 || visibles[i - 1].grupo !== child.grupo ? child.grupo : null;
  }

  hasVisibleChildren(item: NavItem): boolean {
    return item.children?.some((child) => this.isVisible(child)) ?? false;
  }

  isActive(route: string): boolean {
    if (this.currentRoute !== route && !this.currentRoute.startsWith(route + '/')) return false;
    // Si otra entrada del menú es más concreta y también coincide (p. ej.
    // /activos/mis-equipos frente a /activos), solo se marca esa.
    return !this.rutasDelMenu.some(
      (r) => r.length > route.length && r.startsWith(route + '/')
        && (this.currentRoute === r || this.currentRoute.startsWith(r + '/'))
    );
  }

  /** Todas las rutas del menú (padres e hijos), para desempatar el activo. */
  private get rutasDelMenu(): string[] {
    if (!this._rutas) {
      this._rutas = this.navItems.flatMap((i) => [i.route, ...(i.children || []).map((c) => c.route)]);
    }
    return this._rutas;
  }
  private _rutas: string[] | null = null;

  /** Indica si el grupo padre está activo (algún hijo visible en su sección). */
  hasActiveChild(item: NavItem): boolean {
    return item.children?.some(child => this.isChildActive(child, item)) ?? false;
  }

  /**
   * Activo para un hijo. El hijo "landing" que comparte la misma ruta que el
   * grupo (p.ej. "Panel" con /admin) solo se resalta en su propia página, para
   * que no quede siempre marcado al navegar a otras secciones de admin.
   */
  isChildActive(child: NavItem, parent: NavItem): boolean {
    if (child.route === parent.route) return this.currentRoute === child.route;
    return this.isActive(child.route);
  }

  get initials(): string {
    const u = this.user;
    if (u?.displayName) return u.displayName.charAt(0).toUpperCase();
    if (u?.firstName) return u.firstName.charAt(0).toUpperCase();
    if (u?.corporateEmailUser) return u.corporateEmailUser.charAt(0).toUpperCase();
    const email = this.authService.getEmail();
    return email ? email.charAt(0).toUpperCase() : 'U';
  }

  get roleLabel(): string {
    switch (this.role?.toUpperCase()) {
      case 'SUPER_ADMIN': return 'Super Administrador';
      case 'AUDITOR': return 'Auditor';
      case 'AGENT': return 'Agente';
      case 'USER': return 'Usuario';
      case 'AREA_MANAGER': return 'Jefe de área';
      default: return this.role || '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/acceso/ingresar']);
  }
}
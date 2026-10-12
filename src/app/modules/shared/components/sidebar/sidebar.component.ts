import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AdminService } from '../../../../core/services/admin.service';
import { SseService } from '../../../../core/services/sse.service';
import { User } from '../../../../models/user.model';
import { environment } from '../../../../../environments/environment';
import { navIcon } from '../../../../core/constants/nav-icons';
import { GlobalSearchService } from '../../../../core/services/global-search.service';
import { metaSesion, normalizarSesion, SessionState } from '../../../../core/utils/session-presence.util';

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
  isOpen = true;
  isMobile = false;
  collapsed = false;
  currentRoute = '';
  logoUrl = '';
  iconUrl = '';
  user: User | null = null;
  sseStatus: 'connecting' | 'connected' | 'closed' = 'closed';
  private sseSub?: Subscription;
  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      seccion: 'principal',
      route: '/dashboard',
      icon: navIcon('dashboard'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER']
    },
    {
      label: 'Tablero de Tickets',
      seccion: 'principal',
      route: '/tickets/kanban',
      icon: navIcon('kanban'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Mis Tickets',
      seccion: 'principal',
      route: '/tickets/mine',
      icon: navIcon('mine'),
      roles: ['USER']
    },
    {
      label: 'Administración',
      seccion: 'gestion',
      route: '/admin',
      icon: navIcon('admin'),
      roles: ['SUPER_ADMIN', 'ADMIN'],
      children: [
        { label: 'Panel', route: '/admin', icon: navIcon('admin-panel'), roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Usuarios', route: '/admin/users', icon: navIcon('users'), roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Equipos', route: '/admin/teams', icon: navIcon('teams'), roles: ['SUPER_ADMIN'] },
        { label: 'Áreas', route: '/admin/areas', icon: navIcon('areas'), roles: ['SUPER_ADMIN'] },
        { label: 'Sedes', route: '/admin/sucursales', icon: navIcon('sucursales'), roles: ['SUPER_ADMIN'] },
        { label: 'Categorías', route: '/admin/categories', icon: navIcon('categories'), roles: ['SUPER_ADMIN'] },
        { label: 'SLA', route: '/admin/sla', icon: navIcon('sla'), roles: ['SUPER_ADMIN'] },
        { label: 'Evaluaciones Mensuales', route: '/admin/sla-config', icon: navIcon('sla-evaluations'), roles: ['SUPER_ADMIN'] },
        { label: 'Escalaciones', route: '/admin/escalations', icon: navIcon('escalations'), roles: ['SUPER_ADMIN'] },
        { label: 'Tipos de Ticket', route: '/admin/ticket-types', icon: navIcon('categories'), roles: ['SUPER_ADMIN'] },
        { label: 'Plantillas', route: '/admin/templates', icon: navIcon('templates'), roles: ['SUPER_ADMIN'] },
        { label: 'Configuración de Marca', route: '/admin/branding', icon: navIcon('branding'), roles: ['SUPER_ADMIN'] },
        { label: 'Páginas del Sistema', route: '/admin/pages-system', icon: navIcon('pages-system'), roles: ['SUPER_ADMIN'] },
        { label: 'Autenticación MFA', route: '/admin/mfa', icon: navIcon('mfa'), roles: ['SUPER_ADMIN'] },
        { label: 'Inteligencia Artificial', route: '/admin/ai-config', icon: navIcon('ai-config'), roles: ['SUPER_ADMIN'] },
        { label: 'Microsoft Graph y Correo', route: '/admin/microsoft-graph', icon: navIcon('microsoft-graph'), roles: ['SUPER_ADMIN'] },
        { label: 'Seguridad de Sesión', route: '/admin/session-config', icon: navIcon('session-config'), roles: ['SUPER_ADMIN'] },
        { label: 'Acuses de Lectura', route: '/admin/chat-config', icon: navIcon('chat-config'), roles: ['SUPER_ADMIN'] },
        { label: 'Cola de correo', route: '/admin/mail-outbox', icon: navIcon('mail-outbox'), roles: ['SUPER_ADMIN'] },
        // Programar una automatizacion es escribir codigo con permisos ajenos,
        // asi que queda fuera del ADMIN igual que en el backend.
        { label: 'Automatizaciones', route: '/workflows', icon: navIcon('workflows'), roles: ['SUPER_ADMIN'] },
        { label: 'Reportes Personalizados', route: '/admin/reports', icon: navIcon('report-templates'), roles: ['SUPER_ADMIN'] }
      ]
    },
    {
      // Pasos de las automatizaciones que esperan una decisión. El servidor solo
      // devuelve los que cada uno puede decidir.
      label: 'Aprobaciones',
      seccion: 'principal',
      route: '/aprobaciones',
      icon: navIcon('aprobaciones'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER']
    },
    {
      label: 'Actividades',
      seccion: 'trabajo',
      route: '/activities',
      icon: navIcon('kanban'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Calendario',
      seccion: 'trabajo',
      route: '/calendar',
      icon: navIcon('calendar'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT']
    },
    {
      label: 'Reportes',
      seccion: 'trabajo',
      route: '/reports',
      icon: navIcon('reports'),
      roles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      label: 'Configuración',
      seccion: 'cuenta',
      route: '/settings',
      icon: navIcon('settings'),
      roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'],
      children: [
        { label: 'Mi Perfil', route: '/settings/profile', icon: navIcon('profile'), roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'] },
        { label: 'Cambiar Contraseña', route: '/settings/password', icon: navIcon('password'), roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'] },
        { label: 'Sonidos de Notificaciones', route: '/settings/sounds', icon: navIcon('sounds'), roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT', 'USER'] }
      ]
    }
  ];

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
    this.role = this.authService.getRole();
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
    return `${environment.apiUrl}${this.user.photoUrl}`;
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
    this.isMobile = window.innerWidth < 768;
    if (!this.isMobile) this.isOpen = true;
  }

  toggleSidebar(): void {
    if (this.isMobile) {
      this.isOpen = !this.isOpen;
    } else {
      this.collapsed = !this.collapsed;
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
    return item.roles.includes(this.role);
  }

  hasVisibleChildren(item: NavItem): boolean {
    return item.children?.some(child => child.roles.includes(this.role)) ?? false;
  }

  isActive(route: string): boolean {
    return this.currentRoute === route || this.currentRoute.startsWith(route + '/');
  }

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
      case 'ADMIN': return 'Administrador';
      case 'AGENT': return 'Agente';
      case 'USER': return 'Usuario';
      default: return this.role || '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
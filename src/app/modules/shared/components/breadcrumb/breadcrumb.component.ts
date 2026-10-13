import { Component, OnDestroy, OnInit, Optional } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, UrlSegment } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { navIcon } from '../../../../core/constants/nav-icons';
import { BreadcrumbService, EtiquetaCrumb } from '../../../../core/services/breadcrumb.service';

export interface Crumb {
  label: string;
  url: string;
  icon: string;
  /**
   * Si la url es navegable como ruta intermedia. Los ids numericos no lo son
   * salvo en tickets: /workflows/5 no existe como ruta (sus hijos son editar y
   * ejecuciones), y el clic no debe caer en el 404.
   */
  enlazable: boolean;
}

/** Las claves son uuid desde la migración de ids (V3__ids_uuid.sql). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  tickets: 'Tickets',
  new: 'Nuevo ticket',
  mine: 'Mis tickets',
  assigned: 'Mis asignados',
  kanban: 'Tablero de tickets',
  activos: 'Activos de TI',
  admin: 'Administración',
  users: 'Usuarios',
  teams: 'Equipos',
  areas: 'Áreas',
  sucursales: 'Sedes',
  categories: 'Categorías',
  sla: 'SLA',
  'sla-config': 'Evaluaciones mensuales',
  'report-templates': 'Reportes personalizados',
  escalations: 'Escalaciones',
  templates: 'Plantillas',
  branding: 'Marca',
  'pages-system': 'Páginas del Sistema',
  mfa: 'Autenticación MFA',
  'ai-config': 'Inteligencia Artificial',
  'microsoft-graph': 'Microsoft Graph y Correo',
  'session-config': 'Seguridad de Sesión',
  'chat-config': 'Acuses de Lectura',
  'mail-outbox': 'Cola de correo',
  'ticket-types': 'Tipos de ticket',
  'audit-sistema': 'Auditoría del sistema',
  reports: 'Reportes',
  workflows: 'Automatizaciones',
  ejecuciones: 'Ejecuciones',
  aprobaciones: 'Aprobaciones',
  editar: 'Editar',
  mantenimiento: 'Mantenimiento',
  activities: 'Tablero de tareas',
  calendar: 'Calendario',
  settings: 'Configuración',
  profile: 'Perfil',
  password: 'Cambiar contraseña',
  sounds: 'Sonidos de Notificaciones',
  notifications: 'Notificaciones',
  privacidad: 'Privacidad',
  '404': 'Página no encontrada',
  '403': 'Acceso no autorizado',
  '500': 'Error interno del servidor',
  '503': 'Servicio no disponible'
};

@Component({
  selector: 'app-breadcrumb',
  template: `
    <nav *ngIf="crumbs.length" aria-label="Breadcrumb" class="mt-4 mb-4">
      <ul class="flex items-center gap-3 flex-wrap">

        <!-- Crumbs intermedios (clickeables si la ruta existe) -->
        <ng-container *ngFor="let c of crumbs; let last = last">
          <li *ngIf="!last">
            <div class="flex items-center gap-3">
              <a
                *ngIf="c.enlazable"
                [routerLink]="c.url"
                class="text-base-content/70 font-medium text-sm leading-snug flex items-center gap-2
                       hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded
                       transition-colors"
              >
                <i [class]="c.icon" class="text-sm leading-none" aria-hidden="true"></i>
                {{ c.label }}
              </a>

              <!-- Segmento intermedio sin ruta propia (ej. /workflows/5): se muestra, pero no se enlaza. -->
              <span
                *ngIf="!c.enlazable"
                class="text-base-content/50 font-medium text-sm leading-snug flex items-center gap-2"
              >
                <i [class]="c.icon" class="text-sm leading-none" aria-hidden="true"></i>
                {{ c.label }}
              </span>

              <!-- Chevron separador -->
              <svg xmlns="http://www.w3.org/2000/svg"
                   class="fill-base-content/30 size-2.5 overflow-visible"
                   viewBox="0 0 451.846 451.847" aria-hidden="true">
                <path d="M345.441 248.292 151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373"
                      data-original="#000000" />
              </svg>
            </div>
          </li>

          <!-- Último crumb (actual) -->
          <li *ngIf="last" aria-current="page">
            <div class="flex items-center">
              <span class="text-primary text-sm leading-snug flex items-center gap-2 font-semibold">
                <i [class]="c.icon" class="text-sm leading-none" aria-hidden="true"></i>
                {{ c.label }}
              </span>
            </div>
          </li>
        </ng-container>

      </ul>
    </nav>
  `
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  crumbs: Crumb[] = [];

  private sub?: Subscription;
  private subEtiquetas?: Subscription;
  /** Nombre e icono que fija la pantalla para su URL (p. ej. el tipo de activo). */
  private etiquetas: ReadonlyMap<string, EtiquetaCrumb> = new Map();

  /** El servicio es opcional para que el spec pueda crear el componente con solo el Router. */
  constructor(private router: Router, @Optional() private breadcrumbService?: BreadcrumbService) {}

  ngOnInit(): void {
    this.build();
    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.build());
    this.subEtiquetas = this.breadcrumbService?.etiquetas$.subscribe((m) => {
      this.etiquetas = m;
      this.build();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subEtiquetas?.unsubscribe();
  }

  private build(): void {
    const deepest = this.deepest(this.router.routerState.snapshot.root);
    const crumbs: Crumb[] = [];
    let url = '';
    let previo = '';

    deepest.pathFromRoot.forEach((sn: ActivatedRouteSnapshot) => {
      sn.url.forEach((seg: UrlSegment) => {
        url += '/' + seg.path;
        if (url === '/dashboard') {
          crumbs.length = 0;
          previo = seg.path;
          return;
        }
        const esId = this.esId(seg, previo);
        crumbs.push({
          label: this.segmentLabel(seg, previo),
          url,
          icon: this.segmentIcon(seg, previo),
          // Solo se enlaza lo que existe como ruta: /workflows/5 no la es.
          enlazable: !esId || previo === 'tickets' || previo === 'activos',
        });
        previo = seg.path;
      });
    });

    if (crumbs.length && crumbs[0].url !== '/dashboard') {
      crumbs.unshift({ label: 'Inicio', url: '/dashboard', icon: 'fa-solid fa-house', enlazable: true });
    }

    // Automatizaciones cuelga del grupo "Administración" del menú lateral,
    // aunque su ruta sea top-level (/workflows). El breadcrumb lo refleja
    // insertando el nivel /admin delante para que la ruta no se pierda.
    const workflows = crumbs.findIndex((c) => c.url === '/workflows');
    if (workflows > 0) {
      crumbs.splice(workflows, 0, {
        label: 'Administración',
        url: '/admin',
        icon: navIcon('admin'),
        enlazable: true,
      });
    }

    // Lo que la pantalla sabe y la URL no (nombre del activo, icono de su tipo).
    for (const c of crumbs) {
      const e = this.etiquetas.get(c.url);
      if (e?.label) c.label = e.label;
      if (e?.icon) c.icon = e.icon;
    }

    this.crumbs = crumbs;
  }

  private deepest(sn: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = sn;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  /**
   * Un segmento es "id" solo bajo las rutas que llevan parametro:
   * /tickets/:id, /activos/:id y /workflows/:id, y solo si es un uuid. Sin
   * contexto, un numero es una ruta propia (las pantallas de error son /404, /403…).
   */
  private esId(seg: UrlSegment, previo: string): boolean {
    return (previo === 'tickets' || previo === 'workflows' || previo === 'activos') && UUID_RE.test(seg.path);
  }

  /**
   * Label de un segmento. El segmento anterior da el contexto: un id suelto es
   * "Detalle del ticket" o "Proceso" segun de que ruta venga (el uuid no se
   * muestra: no dice nada a quien lo lee), y "reports" bajo
   * "/admin" es la gestion de plantillas, no la pantalla de reportes.
   */
  private segmentLabel(seg: UrlSegment, previo: string): string {
    if (this.esId(seg, previo)) {
      if (previo === 'tickets') return 'Detalle del ticket';
      if (previo === 'activos') return 'Detalle del activo';
      return 'Proceso';
    }
    if (seg.path === 'reports' && previo === 'admin') return 'Reportes personalizados';
    if (seg.path === 'new' && previo === 'activos') return 'Nuevo activo';
    return LABELS[seg.path] ?? this.titleCase(seg.path);
  }

  private segmentIcon(seg: UrlSegment, previo: string): string {
    if (this.esId(seg, previo)) {
      if (previo === 'tickets') return 'fa-solid fa-ticket';
      if (previo === 'activos') return 'fa-solid fa-laptop';
      return 'fa-solid fa-diagram-project';
    }
    if (seg.path === 'reports' && previo === 'admin') return navIcon('report-templates');
    return navIcon(seg.path);
  }

  private titleCase(value: string): string {
    return value
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
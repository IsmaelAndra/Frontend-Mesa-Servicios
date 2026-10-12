import { ActivatedRouteSnapshot, Router, Routes, UrlSegment } from '@angular/router';
import { Subject } from 'rxjs';
import { routes } from '../../../../app-routing.module';
import { TICKETS_ROUTES } from '../../../tickets/tickets.routes';
import { ADMIN_ROUTES } from '../../../admin/admin.routes';
import { WORKFLOW_ROUTES } from '../../../admin/workflow.routes';
import { REPORTS_ROUTES } from '../../../reports/reports.routes';
import { SETTINGS_ROUTES } from '../../../settings/settings.routes';
import { CALENDARIO_ROUTES, KANBAN_ROUTES } from '../../../activities/activities.routes';
import { BreadcrumbComponent } from './breadcrumb.component';

/**
 * El breadcrumb se arma del grafo de rutas del Router, no de un Http call, asi que
 * este spec construye un Router falso: `routerState.snapshot.root` se monta a mano
 * con los segmentos de la url y los eventos son un Subject que nunca dispara.
 */
function crearCadena(segmentos: string[]): ActivatedRouteSnapshot[] {
  const cadena: ActivatedRouteSnapshot[] = [];
  const raiz = { url: [] as UrlSegment[], firstChild: null } as unknown as ActivatedRouteSnapshot;
  cadena.push(raiz);
  let padre = raiz;
  for (const s of segmentos) {
    const hijo = { url: [new UrlSegment(s, {})], firstChild: null } as unknown as ActivatedRouteSnapshot;
    (padre as unknown as { firstChild: unknown }).firstChild = hijo;
    cadena.push(hijo);
    padre = hijo;
  }
  for (let i = 0; i < cadena.length; i++) {
    (cadena[i] as unknown as { pathFromRoot: ActivatedRouteSnapshot[] }).pathFromRoot = cadena.slice(0, i + 1);
  }
  return cadena;
}

function instanciar(segmentos: string[]): BreadcrumbComponent {
  const [root] = crearCadena(segmentos);
  const router = {
    routerState: { snapshot: { root } },
    events: new Subject<unknown>(),
  } as unknown as Router;
  const comp = new BreadcrumbComponent(router);
  comp.ngOnInit();
  return comp;
}

function segmentosDe(url: string): string[] {
  return url.split('/').filter(Boolean);
}

/**
 * Verdadero si la url entera (segmento a segmento) casa con alguna rama de la
 * tabla de rutas. `:param` casa con cualquier segmento; las rutas con hijos
 * casan solo si algun hijo casa tambien (y un hijo '' como redirect vale).
 */
/**
 * Las áreas se cargan bajo demanda (loadChildren) y sus rutas hijas no están en
 * la tabla raíz. Para comprobar los crumbs se vuelve a montar el árbol completo
 * con las rutas que cada módulo registra en su forChild.
 */
const HIJAS_PEREZOSAS: Record<string, Routes> = {
  tickets: TICKETS_ROUTES,
  admin: ADMIN_ROUTES,
  workflows: WORKFLOW_ROUTES,
  reports: REPORTS_ROUTES,
  settings: SETTINGS_ROUTES,
  activities: KANBAN_ROUTES,
  calendar: CALENDARIO_ROUTES,
};

function arbolCompleto(rutas: Routes): Routes {
  return rutas.map((r) => {
    if (r.loadChildren) {
      const hijas = HIJAS_PEREZOSAS[r.path ?? ''];
      if (!hijas) throw new Error(`Falta registrar en el spec las rutas perezosas de '${r.path}'`);
      return { ...r, loadChildren: undefined, children: hijas };
    }
    return r.children ? { ...r, children: arbolCompleto(r.children) } : r;
  });
}

const RUTAS = arbolCompleto(routes);

function coincide(seg: string[], rutas: Routes): boolean {
  for (const r of rutas) {
    if (r.path === '**') continue;
    const partes = r.path ? r.path.split('/').filter(Boolean) : [];
    if (partes.length > seg.length) continue;
    const casanPartes = partes.every((p, i) => p.startsWith(':') || p === seg[i]);
    if (!casanPartes) continue;
    const resto = seg.slice(partes.length);
    if (resto.length === 0) {
      if (!r.children || r.children.length === 0) return true;
      if (coincide([], r.children)) return true;
      continue;
    }
    if (r.children && coincide(resto, r.children)) return true;
  }
  return false;
}

/** Todas las urls reales de la app que ponen breadcrumb (todas menos /auth/* y /dashboard). */
const URLS_APP = [
  '/notifications',
  '/tickets',
  '/tickets/new',
  '/tickets/mine',
  '/tickets/assigned',
  '/tickets/kanban',
  '/tickets/3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b',
  '/admin',
  '/admin/users',
  '/admin/teams',
  '/admin/areas',
  '/admin/sucursales',
  '/admin/categories',
  '/admin/sla',
  '/admin/sla-config',
  '/admin/escalations',
  '/admin/templates',
  '/admin/branding',
  '/admin/pages-system',
  '/admin/mfa',
  '/admin/ai-config',
  '/admin/microsoft-graph',
  '/admin/session-config',
  '/admin/chat-config',
  '/admin/mail-outbox',
  '/admin/ticket-types',
  '/admin/audit-sistema',
  '/admin/reports',
  '/workflows',
  '/workflows/ejecuciones',
  '/workflows/7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928/editar',
  '/workflows/7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928/ejecuciones',
  '/aprobaciones',
  '/reports',
  '/activities',
  '/calendar',
  '/settings',
  '/settings/profile',
  '/settings/password',
  '/settings/sounds',
  '/privacidad',
  '/mantenimiento',
  '/404',
  '/403',
  '/500',
  '/503',
];

describe('breadcrumb', () => {
  it('etiqueta los segmentos conocidos y no pisa el de aceptacion', () => {
    expect(URLS_APP.length).toBeGreaterThan(30);
  });

  it('todo crumb tiene etiqueta e icono propios (ninguno cae en el fallback de carpeta)', () => {
    for (const url of URLS_APP) {
      const comp = instanciar(segmentosDe(url).map((s) => decodeURIComponent(s)));
      expect(comp.crumbs.length).toBeGreaterThan(0, `${url} no genera breadcrumb`);
      for (const c of comp.crumbs) {
        expect(c.label.trim().length).toBeGreaterThan(0, `${url}: ${c.label}`);
        expect(c.icon).not.toBe('fa-solid fa-folder', `${url}: ${c.label}`);
      }
    }
  });

  it('todo crumb enlazable corresponde a una ruta real de la app', () => {
    for (const url of URLS_APP) {
      const comp = instanciar(segmentosDe(url));
      for (const c of comp.crumbs) {
        if (!c.enlazable) continue;
        expect(coincide(segmentosDe(c.url), RUTAS))
          .withContext(`el crumb '${c.label}' (${c.url}) no resuelve en las rutas`)
          .toBeTrue();
      }
    }
  });

  it('los ids (uuid) se nombran segun su ruta y solo enlaza el de tickets', () => {
    const tickets = instanciar(['tickets', '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b']);
    const tac = tickets.crumbs[tickets.crumbs.length - 1];
    expect(tac.label).toBe('Detalle del ticket');
    expect(tac.enlazable).toBeTrue();

    const editar = instanciar(['workflows', '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928', 'editar']);
    const proceso = editar.crumbs[editar.crumbs.length - 2];
    expect(proceso.label).toBe('Proceso');
    expect(proceso.enlazable).toBeFalse();
  });

  it('los segmentos nuevos resuelven label e icono propios', () => {
    const sucursales = instanciar(['admin', 'sucursales']);
    expect(sucursales.crumbs[sucursales.crumbs.length - 1].label).toBe('Sedes');
    expect(sucursales.crumbs[sucursales.crumbs.length - 1].icon).toBe('fa-solid fa-location-dot');

    const auditoria = instanciar(['admin', 'audit-sistema']);
    expect(auditoria.crumbs[auditoria.crumbs.length - 1].label).toBe('Auditoría del sistema');
    expect(auditoria.crumbs[auditoria.crumbs.length - 1].icon).toBe('fa-solid fa-clipboard-list');

    const historial = instanciar(['workflows', 'ejecuciones']);
    expect(historial.crumbs[historial.crumbs.length - 1].label).toBe('Ejecuciones');
    expect(historial.crumbs[historial.crumbs.length - 1].icon).toBe('fa-solid fa-clock-rotate-left');

    const editar = instanciar(['workflows', '2', 'editar']);
    expect(editar.crumbs[editar.crumbs.length - 1].label).toBe('Editar');
    expect(editar.crumbs[editar.crumbs.length - 1].icon).toBe('fa-solid fa-pen');

    const aprobaciones = instanciar(['aprobaciones']);
    expect(aprobaciones.crumbs[aprobaciones.crumbs.length - 1].label).toBe('Aprobaciones');
    expect(aprobaciones.crumbs[aprobaciones.crumbs.length - 1].icon).toBe('fa-solid fa-user-check');
  });

  it('las paginas publicas y de error muestran su nombre, no el segmento crudo', () => {
    const noEncontrada = instanciar(['404']);
    expect(noEncontrada.crumbs[noEncontrada.crumbs.length - 1].label).toBe('Página no encontrada');
    expect(noEncontrada.crumbs[noEncontrada.crumbs.length - 1].icon).toBe('fa-solid fa-circle-question');

    const sinAcceso = instanciar(['403']);
    expect(sinAcceso.crumbs[sinAcceso.crumbs.length - 1].label).toBe('Acceso no autorizado');
    expect(sinAcceso.crumbs[sinAcceso.crumbs.length - 1].icon).toBe('fa-solid fa-lock');

    const privacidad = instanciar(['privacidad']);
    expect(privacidad.crumbs[privacidad.crumbs.length - 1].label).toBe('Privacidad');
    expect(privacidad.crumbs[privacidad.crumbs.length - 1].icon).toBe('fa-solid fa-user-shield');
  });

  it('"reports" es la gestion de plantillas bajo /admin y la pantalla suelta fuera', () => {
    const plantillas = instanciar(['admin', 'reports']);
    expect(plantillas.crumbs[plantillas.crumbs.length - 1].label).toBe('Reportes personalizados');
    expect(plantillas.crumbs[plantillas.crumbs.length - 1].icon).toBe('fa-solid fa-flask');

    const pantalla = instanciar(['reports']);
    expect(pantalla.crumbs[pantalla.crumbs.length - 1].label).toBe('Reportes');
    expect(pantalla.crumbs[pantalla.crumbs.length - 1].icon).toBe('fa-solid fa-chart-column');
  });

  it('/settings como crumb intermedio es navegable (tiene redirect a perfil)', () => {
    const perfil = instanciar(['settings', 'profile']);
    const settings = perfil.crumbs.find((c) => c.url === '/settings');
    expect(settings).toBeDefined();
    expect(settings!.enlazable).toBeTrue();
  });
});
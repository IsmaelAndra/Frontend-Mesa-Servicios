import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, UrlSegment } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface Crumb {
  label: string;
  url: string;
}

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  tickets: 'Tickets',
  new: 'Nuevo ticket',
  mine: 'Mis tickets',
  assigned: 'Mis asignados',
  kanban: 'Tablero de tickets',
  admin: 'Administración',
  users: 'Usuarios',
  teams: 'Equipos',
  areas: 'Áreas',
  categories: 'Categorías',
  sla: 'SLA',
  escalations: 'Escalaciones',
  templates: 'Plantillas',
  branding: 'Marca',
  'ticket-types': 'Tipos de ticket',
  reports: 'Reportes',
  activities: 'Tablero de tareas',
  calendar: 'Calendario',
  settings: 'Configuración',
  profile: 'Perfil',
  password: 'Cambiar contraseña'
};

@Component({
  selector: 'app-breadcrumb',
  template: `
    <nav *ngIf="crumbs.length" class="breadcrumbs text-sm mb-4" aria-label="Miga de pan">
      <ul>
        <li *ngFor="let c of crumbs; let last = last">
          <ng-container *ngIf="!last">
            <a [routerLink]="c.url">{{ c.label }}</a>
          </ng-container>
          <ng-container *ngIf="last">
            <span class="font-semibold text-primary">{{ c.label }}</span>
          </ng-container>
        </li>
      </ul>
    </nav>
  `
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  crumbs: Crumb[] = [];

  private sub?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.build();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.build());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private build(): void {
    const deepest = this.deepest(this.router.routerState.snapshot.root);
    const crumbs: Crumb[] = [];
    let url = '';

    deepest.pathFromRoot.forEach((sn: ActivatedRouteSnapshot) => {
      sn.url.forEach((seg: UrlSegment) => {
        url += '/' + seg.path;
        if (url === '/dashboard') {
          crumbs.length = 0;
          return;
        }
        crumbs.push({ label: this.segmentLabel(seg), url });
      });
    });

    if (crumbs.length && crumbs[0].url !== '/dashboard') {
      crumbs.unshift({ label: 'Inicio', url: '/dashboard' });
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

  private segmentLabel(seg: UrlSegment): string {
    if (Object.keys(seg.parameters).length > 0) {
      return seg.path && /^\d+$/.test(seg.path) ? `Ticket #${seg.path}` : this.titleCase(seg.path);
    }
    return LABELS[seg.path] ?? this.titleCase(seg.path);
  }

  private titleCase(value: string): string {
    return value
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
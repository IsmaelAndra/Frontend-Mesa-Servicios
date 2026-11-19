import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { TicketListComponent } from './ticket-list/ticket-list.component';
import { TicketNewComponent } from './ticket-new/ticket-new.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';
import { TicketKanbanComponent } from './ticket-kanban/ticket-kanban.component';
import { PanelSlaComponent } from './panel-sla/panel-sla.component';

/** Rutas bajo /tickets. Se cargan bajo demanda (ver app-routing.module.ts). */
export const TICKETS_ROUTES: Routes = [
  { path: '', component: TicketListComponent, canActivate: [AuthGuard] },
  { path: 'nuevo', component: TicketNewComponent, canActivate: [AuthGuard] },
  { path: 'mios', component: TicketListComponent, canActivate: [AuthGuard], data: { mine: true } },
  { path: 'asignados', component: TicketListComponent, canActivate: [AuthGuard], data: { assigned: true } },
  { path: 'tablero', component: TicketKanbanComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'AUDITOR'] } },
  { path: 'panel-sla', component: PanelSlaComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AUDITOR'] } },
  // Al pasar de un ticket a otro el componente se crea de nuevo: lee el id una
  // sola vez y, reutilizado, seguía mostrando el ticket anterior.
  // Direcciones antiguas en inglés (correos ya enviados).
  { path: 'new', redirectTo: 'nuevo' },
  { path: 'mine', redirectTo: 'mios' },
  { path: 'assigned', redirectTo: 'asignados' },
  { path: 'kanban', redirectTo: 'tablero' },
  { path: ':id', component: TicketDetailComponent, canActivate: [AuthGuard], data: { recrearAlCambiarParametros: true } },
];

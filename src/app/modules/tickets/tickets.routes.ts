import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';
import { TicketListComponent } from './ticket-list/ticket-list.component';
import { TicketNewComponent } from './ticket-new/ticket-new.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';
import { TicketKanbanComponent } from './ticket-kanban/ticket-kanban.component';

/** Rutas bajo /tickets. Se cargan bajo demanda (ver app-routing.module.ts). */
export const TICKETS_ROUTES: Routes = [
  { path: '', component: TicketListComponent, canActivate: [AuthGuard] },
  { path: 'new', component: TicketNewComponent, canActivate: [AuthGuard] },
  { path: 'mine', component: TicketListComponent, canActivate: [AuthGuard], data: { mine: true } },
  { path: 'assigned', component: TicketListComponent, canActivate: [AuthGuard], data: { assigned: true } },
  { path: 'kanban', component: TicketKanbanComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] } },
  // Al pasar de un ticket a otro el componente se crea de nuevo: lee el id una
  // sola vez y, reutilizado, seguía mostrando el ticket anterior.
  { path: ':id', component: TicketDetailComponent, canActivate: [AuthGuard], data: { recrearAlCambiarParametros: true } },
];

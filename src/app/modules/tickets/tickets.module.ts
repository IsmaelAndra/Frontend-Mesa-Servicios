import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { TICKETS_ROUTES } from './tickets.routes';
import { TicketListComponent } from './ticket-list/ticket-list.component';
import { TicketNewComponent } from './ticket-new/ticket-new.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';
import { TicketKanbanComponent } from './ticket-kanban/ticket-kanban.component';
import { TicketHistorialComponent } from './ticket-historial/ticket-historial.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [TicketListComponent, TicketNewComponent, TicketDetailComponent, TicketKanbanComponent, TicketHistorialComponent],
  // ngModel llega por SharedModule, que reexporta PrimeNGModule y este FormsModule.
  imports: [SharedModule, DragDropModule, RouterModule.forChild(TICKETS_ROUTES)],
  exports: [TicketListComponent, TicketNewComponent, TicketDetailComponent, TicketKanbanComponent]
})
export class TicketsModule {}
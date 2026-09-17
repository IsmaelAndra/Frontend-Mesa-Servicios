import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TicketListComponent } from './ticket-list/ticket-list.component';
import { TicketNewComponent } from './ticket-new/ticket-new.component';
import { TicketDetailComponent } from './ticket-detail/ticket-detail.component';
import { TicketKanbanComponent } from './ticket-kanban/ticket-kanban.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [TicketListComponent, TicketNewComponent, TicketDetailComponent, TicketKanbanComponent],
  imports: [SharedModule, DragDropModule],
  exports: [TicketListComponent, TicketNewComponent, TicketDetailComponent, TicketKanbanComponent]
})
export class TicketsModule {}
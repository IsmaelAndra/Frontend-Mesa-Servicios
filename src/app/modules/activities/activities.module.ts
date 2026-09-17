import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { PrimeNGModule } from '../shared/primeng.module';
import { KanbanComponent } from './kanban/kanban.component';
import { CalendarComponent } from './calendar/calendar.component';

@NgModule({
  declarations: [KanbanComponent, CalendarComponent],
  imports: [CommonModule, RouterModule, DragDropModule, PrimeNGModule],
  exports: [KanbanComponent, CalendarComponent]
})
export class ActivitiesModule {}
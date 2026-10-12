import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ActivitiesModule } from './activities.module';
import { KanbanComponent } from './kanban/kanban.component';
import { CalendarComponent } from './calendar/calendar.component';

/*
 * El tablero (/activities) y el calendario (/calendar) son dos URLs de primer
 * nivel servidas por el mismo módulo. Un módulo solo admite un forChild, así que
 * cada URL tiene su envoltorio de rutas; los dos comparten el chunk de
 * ActivitiesModule (el calendario de Toast UI solo se descarga al entrar).
 */
export const KANBAN_ROUTES: Routes = [{ path: '', component: KanbanComponent }];
export const CALENDARIO_ROUTES: Routes = [{ path: '', component: CalendarComponent }];

@NgModule({ imports: [ActivitiesModule, RouterModule.forChild(KANBAN_ROUTES)] })
export class KanbanRutasModule {}

@NgModule({ imports: [ActivitiesModule, RouterModule.forChild(CALENDARIO_ROUTES)] })
export class CalendarioRutasModule {}

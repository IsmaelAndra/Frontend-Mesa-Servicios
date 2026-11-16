import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { PROYECTOS_ROUTES } from './proyectos.routes';
import { ProyectoListaComponent } from './proyecto-lista/proyecto-lista.component';
import { ProyectoDetalleComponent } from './proyecto-detalle/proyecto-detalle.component';
import { ProyectoChatComponent } from './proyecto-chat/proyecto-chat.component';

/** Proyectos (Fase 3), cargado bajo demanda en /proyectos. */
@NgModule({
  declarations: [ProyectoListaComponent, ProyectoDetalleComponent, ProyectoChatComponent],
  imports: [SharedModule, DragDropModule, RouterModule.forChild(PROYECTOS_ROUTES)],
})
export class ProyectosModule {}

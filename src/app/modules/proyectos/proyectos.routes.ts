import { Routes } from '@angular/router';
import { ProyectoListaComponent } from './proyecto-lista/proyecto-lista.component';
import { ProyectoDetalleComponent } from './proyecto-detalle/proyecto-detalle.component';

/** Rutas bajo /proyectos (Fase 3). Los permisos los decide el backend. */
export const PROYECTOS_ROUTES: Routes = [
  { path: '', component: ProyectoListaComponent },
  // El detalle lee el id una vez: al ir de un proyecto a otro se recrea.
  { path: ':id', component: ProyectoDetalleComponent, data: { recrearAlCambiarParametros: true } },
];

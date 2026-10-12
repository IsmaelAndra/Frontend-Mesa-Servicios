import { Routes } from '@angular/router';
import { WorkflowListComponent } from './workflow-list/workflow-list.component';
import { WorkflowBuilderComponent } from './workflow-builder/workflow-builder.component';
import { WorkflowExecutionsComponent } from './workflow-executions/workflow-executions.component';

/**
 * Rutas bajo /workflows. Solo SUPER_ADMIN: el guard va en la ruta padre.
 * Los componentes son standalone, así que no necesitan módulo para cargarse.
 */
export const WORKFLOW_ROUTES: Routes = [
  { path: '', component: WorkflowListComponent },
  { path: 'ejecuciones', component: WorkflowExecutionsComponent },
  { path: ':id/editar', component: WorkflowBuilderComponent },
  { path: ':id/ejecuciones', component: WorkflowExecutionsComponent },
];

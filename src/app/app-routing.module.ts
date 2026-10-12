import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { maintenanceGuard } from './core/guards/maintenance.guard';

import { LoginComponent } from './modules/auth/login/login.component';
import { RegisterComponent } from './modules/auth/register/register.component';
import { MantenimientoComponent } from './modules/auth/mantenimiento/mantenimiento.component';
import { PrivacyComponent } from './modules/auth/privacy/privacy.component';
import { ResetPasswordComponent } from './modules/auth/reset-password/reset-password.component';
import { MfaVerifyComponent } from './modules/auth/mfa-verify/mfa-verify.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { NotificationPageComponent } from './modules/shared/components/notification-page/notification-page.component';

// Exportado para los tests: el spec del breadcrumb verifica que cada crumb
// enlazable corresponda a una ruta real de esta tabla.
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  { path: 'auth/restablecer', component: ResetPasswordComponent },
  { path: 'auth/mfa', component: MfaVerifyComponent },

// Paginas de error y aviso. Van fuera del guard de mantenimiento para no
    // redirigirse a si mismas, y sin AuthGuard para que tambien cubran a quien
    // no tiene sesion: el 403 aparece justo cuando el rol no alcanza y el 500
    // cuando el backend no responde, y en ninguno de los dos casos hay sesion
    // valida. Cada codigo tiene su propia ruta y su `data.status`, que el
    // componente resuelve a su texto (logo incluido, guardado en pages-system).
    // `/mantenimiento` es el aviso de mantenimiento previsto (sin codigo HTTP).
    { path: 'mantenimiento', component: MantenimientoComponent },
    { path: '404', component: MantenimientoComponent, data: { status: 404 } },
    { path: '403', component: MantenimientoComponent, data: { status: 403 } },
    { path: '500', component: MantenimientoComponent, data: { status: 500 } },
    { path: '503', component: MantenimientoComponent, data: { status: 503 } },

    // Política de privacidad. Publica y sin AuthGuard por el mismo motivo: se
    // consulta precisamente cuando algo falló y hay que saber como se tratan
    // los datos. Se enlaza desde las propias pantallas de error.
    { path: 'privacidad', component: PrivacyComponent },

  // Rutas bajo autenticacion, bloqueadas si el admin activo el mantenimiento.
  // Se exceptuan /admin/pages-system y /admin/branding (por donde se apaga el
  // modo) y /auth/*.
  {
    path: '',
    canActivate: [maintenanceGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
      { path: 'notifications', component: NotificationPageComponent, canActivate: [AuthGuard] },

      // Las áreas de la aplicación se descargan al entrar en ellas (lazy loading):
      // quien solo abre tickets no se baja el panel de administración, el
      // constructor de workflows ni el calendario. Cada módulo define sus rutas
      // hijas en su *.routes.ts.
      { path: 'tickets', canActivate: [AuthGuard], loadChildren: () => import('./modules/tickets/tickets.module').then((m) => m.TicketsModule) },

      {
        path: 'admin',
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadChildren: () => import('./modules/admin/admin.module').then((m) => m.AdminModule)
      },

      // Motor de workflows. Solo SUPER_ADMIN: programar una automatizacion es
      // escribir codigo con permisos ajenos, y eso no lo decide un ADMIN.
      // Van fuera de "admin" porque el menú y la navegación usan /workflows; dentro
      // de "admin" la ruta real era /admin/workflows y el menú no llevaba a ningún sitio.
      {
        path: 'workflows',
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['SUPER_ADMIN'] },
        loadChildren: () => import('./modules/admin/workflow.routes').then((m) => m.WORKFLOW_ROUTES)
      },
      // La bandeja la ve cualquiera con sesión; el servidor filtra qué puede decidir cada uno.
      {
        path: 'aprobaciones',
        canActivate: [AuthGuard],
        loadComponent: () => import('./modules/admin/workflow-approvals/workflow-approvals.component').then((m) => m.WorkflowApprovalsComponent)
      },

      { path: 'reports', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] }, loadChildren: () => import('./modules/reports/reports.module').then((m) => m.ReportsModule) },

      { path: 'activities', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] }, loadChildren: () => import('./modules/activities/activities.routes').then((m) => m.KanbanRutasModule) },
      { path: 'calendar', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] }, loadChildren: () => import('./modules/activities/activities.routes').then((m) => m.CalendarioRutasModule) },

      { path: 'settings', canActivate: [AuthGuard], loadChildren: () => import('./modules/settings/settings.module').then((m) => m.SettingsModule) }
    ]
  },

  // Ruta desconocida: se muestra la pantalla de 404 (ruta propia, sin query).
  { path: '**', redirectTo: '404' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
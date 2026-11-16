import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { maintenanceGuard } from './core/guards/maintenance.guard';
import { soloEscritorioGuard } from './core/guards/solo-escritorio.guard';

import { LoginComponent } from './modules/auth/login/login.component';
import { RegisterComponent } from './modules/auth/register/register.component';
import { MantenimientoComponent } from './modules/auth/mantenimiento/mantenimiento.component';
import { PrivacyComponent } from './modules/auth/privacy/privacy.component';
import { ResetPasswordComponent } from './modules/auth/reset-password/reset-password.component';
import { MfaVerifyComponent } from './modules/auth/mfa-verify/mfa-verify.component';
import { NotificationPageComponent } from './modules/shared/components/notification-page/notification-page.component';

// Exportado para los tests: el spec del breadcrumb verifica que cada crumb
// enlazable corresponda a una ruta real de esta tabla.
export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'acceso/ingresar', component: LoginComponent },
  { path: 'acceso/registro', component: RegisterComponent },
  { path: 'acceso/restablecer', component: ResetPasswordComponent },
  { path: 'acceso/verificacion', component: MfaVerifyComponent },

  // Rutas antiguas en inglés (nov 2026 todo pasó a español). Se mantienen como
  // redirección: hay correos ya enviados y marcadores con esas direcciones. La
  // redirección por prefijo conserva el resto de la ruta (/workflows/5/editar).
  { path: 'auth/login', redirectTo: 'acceso/ingresar' },
  { path: 'auth/register', redirectTo: 'acceso/registro' },
  { path: 'auth/restablecer', redirectTo: 'acceso/restablecer' },
  { path: 'auth/mfa', redirectTo: 'acceso/verificacion' },
  { path: 'dashboard', redirectTo: 'inicio' },
  { path: 'notifications', redirectTo: 'notificaciones' },
  { path: 'admin/users', redirectTo: 'administracion/usuarios' },
  { path: 'admin/teams', redirectTo: 'administracion/equipos' },
  { path: 'admin/pages-system', redirectTo: 'administracion/paginas-sistema' },
  { path: 'admin/categories', redirectTo: 'administracion/categorias' },
  { path: 'admin/sla-config', redirectTo: 'administracion/evaluaciones' },
  { path: 'admin/escalations', redirectTo: 'administracion/escalaciones' },
  { path: 'admin/templates', redirectTo: 'administracion/plantillas' },
  { path: 'admin/branding', redirectTo: 'administracion/marca' },
  { path: 'admin/ticket-types', redirectTo: 'administracion/tipos-ticket' },
  { path: 'admin/ai-config', redirectTo: 'administracion/inteligencia-artificial' },
  { path: 'admin/microsoft-graph', redirectTo: 'administracion/correo-microsoft' },
  { path: 'admin/session-config', redirectTo: 'administracion/seguridad-sesion' },
  { path: 'admin/audit-sistema', redirectTo: 'administracion/auditoria' },
  { path: 'admin/chat-config', redirectTo: 'administracion/acuses-lectura' },
  { path: 'admin/mail-outbox', redirectTo: 'administracion/cola-correo' },
  { path: 'admin/reports', redirectTo: 'reportes' },
  { path: 'admin', redirectTo: 'administracion' },
  { path: 'workflows', redirectTo: 'automatizaciones' },
  { path: 'reports', redirectTo: 'reportes' },
  { path: 'activities', redirectTo: 'actividades' },
  { path: 'calendar', redirectTo: 'calendario' },
  { path: 'settings/profile', redirectTo: 'mi-cuenta/perfil' },
  { path: 'settings/password', redirectTo: 'mi-cuenta/contrasena' },
  { path: 'settings/sounds', redirectTo: 'mi-cuenta/sonidos' },
  { path: 'settings', redirectTo: 'mi-cuenta' },

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
  // Se exceptuan /administracion/paginas-sistema y /administracion/marca (por
  // donde se apaga el modo) y /acceso/*.
  {
    path: '',
    canActivate: [maintenanceGuard],
    // En el teléfono, las pantallas de solo computador llevan a un aviso.
    canActivateChild: [soloEscritorioGuard],
    children: [
      { path: 'inicio', canActivate: [AuthGuard], loadChildren: () => import('./modules/dashboard/dashboard.module').then((m) => m.DashboardModule) },
      { path: 'solo-computador', canActivate: [AuthGuard], loadComponent: () => import('./modules/shared/components/solo-computador/solo-computador.component').then((m) => m.SoloComputadorComponent) },
      { path: 'notificaciones', component: NotificationPageComponent, canActivate: [AuthGuard] },

      // Las áreas de la aplicación se descargan al entrar en ellas (lazy loading):
      // quien solo abre tickets no se baja el panel de administración, el
      // constructor de workflows ni el calendario. Cada módulo define sus rutas
      // hijas en su *.routes.ts.
      { path: 'tickets', canActivate: [AuthGuard], loadChildren: () => import('./modules/tickets/tickets.module').then((m) => m.TicketsModule) },

      // Inventario de activos de TI. Cualquiera con sesión entra a la lista (el
      // servidor filtra qué ve: USER solo lo suyo), pero crear/editar queda para
      // SUPER_ADMIN/AREA_MANAGER (lo comprueba también el RoleGuard interno).
      { path: 'activos', canActivate: [AuthGuard], loadChildren: () => import('./modules/assets/assets.module').then((m) => m.AssetsModule) },

      {
        path: 'administracion',
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AUDITOR'] },
        loadChildren: () => import('./modules/admin/admin.module').then((m) => m.AdminModule)
      },

      // Motor de workflows. Solo SUPER_ADMIN: programar una automatizacion es
      // escribir codigo con permisos ajenos, y eso no lo decide un ADMIN.
      // Van fuera de "administracion" para que la ruta sea /automatizaciones.
      {
        path: 'automatizaciones',
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['SUPER_ADMIN'] },
        loadChildren: () => import('./modules/admin/workflow.routes').then((m) => m.WORKFLOW_ROUTES)
      },
      // Solo ADMIN y SUPER_ADMIN: el ADMIN sigue sus solicitudes y el SUPER_ADMIN decide.
      {
        path: 'aprobaciones',
        canActivate: [AuthGuard, RoleGuard],
        data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER'] },
        loadComponent: () => import('./modules/admin/workflow-approvals/workflow-approvals.component').then((m) => m.WorkflowApprovalsComponent)
      },

      { path: 'reportes', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AUDITOR'] }, loadChildren: () => import('./modules/reports/reports.module').then((m) => m.ReportsModule) },

      // Proyectos (Fase 3): todos pueden ser miembros; quién ve qué lo decide el backend.
      { path: 'proyectos', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] }, loadChildren: () => import('./modules/proyectos/proyectos.module').then((m) => m.ProyectosModule) },
      { path: 'actividades', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] }, loadChildren: () => import('./modules/activities/activities.routes').then((m) => m.KanbanRutasModule) },
      { path: 'calendario', canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'AREA_MANAGER', 'AGENT', 'USER', 'AUDITOR'] }, loadChildren: () => import('./modules/activities/activities.routes').then((m) => m.CalendarioRutasModule) },

      { path: 'mi-cuenta', canActivate: [AuthGuard], loadChildren: () => import('./modules/settings/settings.module').then((m) => m.SettingsModule) }
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
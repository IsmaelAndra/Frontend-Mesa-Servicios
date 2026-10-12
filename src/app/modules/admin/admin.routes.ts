import { Routes } from '@angular/router';
import { RoleGuard } from '../../core/guards/role.guard';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { SlaConfigComponent } from './sla-config/sla-config.component';
import { AiConfigComponent } from './ai-config/ai-config.component';
import { MicrosoftGraphConfigComponent } from './microsoft-graph-config/microsoft-graph-config.component';
import { SessionConfigComponent } from './session-config/session-config.component';
import { MfaConfigComponent } from './mfa-config/mfa-config.component';
import { AuditSistemaComponent } from './audit-sistema/audit-sistema.component';
import { ChatConfigComponent } from './chat-config/chat-config.component';
import { ReportManagementComponent } from './report-management/report-management.component';
import { TeamManagementComponent } from './team-management/team-management.component';
import { AreaManagementComponent } from './area-management/area-management.component';
import { SucursalManagementComponent } from './sucursal-management/sucursal-management.component';
import { PagesSystemComponent } from './pages-system/pages-system.component';
import { CategoryManagementComponent } from './category-management/category-management.component';
import { SlaManagementComponent } from './sla-management/sla-management.component';
import { EscalationManagementComponent } from './escalation-management/escalation-management.component';
import { TemplateManagementComponent } from './template-management/template-management.component';
import { BrandingComponent } from './branding/branding.component';
import { TicketTypeManagementComponent } from './ticket-type-management/ticket-type-management.component';
import { MailOutboxComponent } from './mail-outbox/mail-outbox.component';

/**
 * Rutas bajo /admin. La ruta padre ya exige sesión y rol ADMIN o SUPER_ADMIN;
 * aquí cada pantalla añade si es solo de SUPER_ADMIN.
 */
export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'users', component: UserManagementComponent },
  { path: 'teams', component: TeamManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'areas', component: AreaManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'sucursales', component: SucursalManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'pages-system', component: PagesSystemComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'categories', component: CategoryManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'sla', component: SlaManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'sla-config', component: SlaConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'escalations', component: EscalationManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'templates', component: TemplateManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  // Esta queda fuera del guard de mantenimiento a proposito: es la
  // unica via para volver a encender el sistema.
  { path: 'branding', component: BrandingComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'ticket-types', component: TicketTypeManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'ai-config', component: AiConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'microsoft-graph', component: MicrosoftGraphConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'session-config', component: SessionConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'mfa', component: MfaConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'audit-sistema', component: AuditSistemaComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'chat-config', component: ChatConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
  { path: 'mail-outbox', component: MailOutboxComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },

  { path: 'reports', component: ReportManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } }
];

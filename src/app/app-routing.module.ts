import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

import { LoginComponent } from './modules/auth/login/login.component';
import { RegisterComponent } from './modules/auth/register/register.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { TicketListComponent } from './modules/tickets/ticket-list/ticket-list.component';
import { TicketNewComponent } from './modules/tickets/ticket-new/ticket-new.component';
import { TicketDetailComponent } from './modules/tickets/ticket-detail/ticket-detail.component';
import { AdminDashboardComponent } from './modules/admin/admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './modules/admin/user-management/user-management.component';
import { SlaConfigComponent } from './modules/admin/sla-config/sla-config.component';
import { SmtpConfigComponent } from './modules/admin/smtp-config/smtp-config.component';
import { AiConfigComponent } from './modules/admin/ai-config/ai-config.component';
import { ReportsComponent } from './modules/reports/reports.component';
import { TeamManagementComponent } from './modules/admin/team-management/team-management.component';
import { AreaManagementComponent } from './modules/admin/area-management/area-management.component';
import { CategoryManagementComponent } from './modules/admin/category-management/category-management.component';
import { SlaManagementComponent } from './modules/admin/sla-management/sla-management.component';
import { EscalationManagementComponent } from './modules/admin/escalation-management/escalation-management.component';
import { TemplateManagementComponent } from './modules/admin/template-management/template-management.component';
import { BrandingComponent } from './modules/admin/branding/branding.component';
import { TicketTypeManagementComponent } from './modules/admin/ticket-type-management/ticket-type-management.component';
import { KanbanComponent } from './modules/activities/kanban/kanban.component';
import { CalendarComponent } from './modules/activities/calendar/calendar.component';
import { TicketKanbanComponent } from './modules/tickets/ticket-kanban/ticket-kanban.component';
import { SettingsProfileComponent } from './modules/settings/profile/profile.component';
import { SettingsPasswordComponent } from './modules/settings/password/password.component';
import { NotificationPageComponent } from './modules/shared/components/notification-page/notification-page.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },

  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'notifications', component: NotificationPageComponent, canActivate: [AuthGuard] },

  { path: 'tickets', component: TicketListComponent, canActivate: [AuthGuard] },
  { path: 'tickets/new', component: TicketNewComponent, canActivate: [AuthGuard] },
  { path: 'tickets/mine', component: TicketListComponent, canActivate: [AuthGuard], data: { mine: true } },
  { path: 'tickets/assigned', component: TicketListComponent, canActivate: [AuthGuard], data: { assigned: true } },
  { path: 'tickets/kanban', component: TicketKanbanComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] } },
  { path: 'tickets/:id', component: TicketDetailComponent, canActivate: [AuthGuard] },

  {
    path: 'admin',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: UserManagementComponent },
      { path: 'teams', component: TeamManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'areas', component: AreaManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'categories', component: CategoryManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'sla', component: SlaManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'escalations', component: EscalationManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'templates', component: TemplateManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'branding', component: BrandingComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'ticket-types', component: TicketTypeManagementComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
      { path: 'smtp', component: SmtpConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } },
      { path: 'ai-config', component: AiConfigComponent, canActivate: [RoleGuard], data: { roles: ['SUPER_ADMIN'] } }
    ]
  },

  { path: 'reports', component: ReportsComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },

  { path: 'activities', component: KanbanComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] } },
  { path: 'calendar', component: CalendarComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT'] } },

  {
    path: 'settings',
    canActivate: [AuthGuard],
    children: [
      { path: 'profile', component: SettingsProfileComponent },
      { path: 'password', component: SettingsPasswordComponent }
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
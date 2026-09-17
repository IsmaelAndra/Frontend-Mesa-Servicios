import { NgModule } from '@angular/core';
import { TeamManagementComponent } from './team-management/team-management.component';
import { AreaManagementComponent } from './area-management/area-management.component';
import { CategoryManagementComponent } from './category-management/category-management.component';
import { SlaManagementComponent } from './sla-management/sla-management.component';
import { EscalationManagementComponent } from './escalation-management/escalation-management.component';
import { TemplateManagementComponent } from './template-management/template-management.component';
import { BrandingComponent } from './branding/branding.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { SlaConfigComponent } from './sla-config/sla-config.component';
import { TicketTypeManagementComponent } from './ticket-type-management/ticket-type-management.component';
import { SmtpConfigComponent } from './smtp-config/smtp-config.component';
import { AiConfigComponent } from './ai-config/ai-config.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    AdminDashboardComponent,
    UserManagementComponent,
    SlaConfigComponent,
    TeamManagementComponent,
    AreaManagementComponent,
    CategoryManagementComponent,
    SlaManagementComponent,
    EscalationManagementComponent,
    TemplateManagementComponent,
    BrandingComponent,
    TicketTypeManagementComponent,
    SmtpConfigComponent,
    AiConfigComponent
  ],
  imports: [SharedModule],
  exports: [
    AdminDashboardComponent,
    UserManagementComponent,
    SlaConfigComponent,
    TeamManagementComponent,
    AreaManagementComponent,
    CategoryManagementComponent,
    SlaManagementComponent,
    EscalationManagementComponent,
    TemplateManagementComponent,
    BrandingComponent,
    TicketTypeManagementComponent,
    SmtpConfigComponent,
    AiConfigComponent
  ]
})
export class AdminModule {}
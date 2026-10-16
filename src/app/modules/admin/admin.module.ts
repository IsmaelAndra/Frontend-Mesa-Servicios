import { NgModule } from '@angular/core';
import { TeamManagementComponent } from './team-management/team-management.component';
import { AreaManagementComponent } from './area-management/area-management.component';
import { SucursalManagementComponent } from './sucursal-management/sucursal-management.component';
import { CategoryManagementComponent } from './category-management/category-management.component';
import { SlaManagementComponent } from './sla-management/sla-management.component';
import { EscalationManagementComponent } from './escalation-management/escalation-management.component';
import { TemplateManagementComponent } from './template-management/template-management.component';
import { BrandingComponent } from './branding/branding.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { SlaConfigComponent } from './sla-config/sla-config.component';
import { TicketTypeManagementComponent } from './ticket-type-management/ticket-type-management.component';
import { AiConfigComponent } from './ai-config/ai-config.component';
import { MicrosoftGraphConfigComponent } from './microsoft-graph-config/microsoft-graph-config.component';
import { TelefoniaConfigComponent } from './telefonia-config/telefonia-config.component';
import { TemasTemporadaComponent } from './temas-temporada/temas-temporada.component';
import { SessionConfigComponent } from './session-config/session-config.component';
import { MfaConfigComponent } from './mfa-config/mfa-config.component';
import { AuditSistemaComponent } from './audit-sistema/audit-sistema.component';
import { ChatConfigComponent } from './chat-config/chat-config.component';
import { ReportManagementComponent } from './report-management/report-management.component';
import { PagesSystemComponent } from './pages-system/pages-system.component';
import { BrandingLogosComponent } from './branding-logos/branding-logos.component';
import { BrandingImagenesComponent } from './branding-imagenes/branding-imagenes.component';
import { BrandingColoresComponent } from './branding-colores/branding-colores.component';
import { BrandingCargaComponent } from './branding-carga/branding-carga.component';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { ADMIN_ROUTES } from './admin.routes';
import { NgChartsModule } from 'ng2-charts';
import { MailOutboxComponent } from './mail-outbox/mail-outbox.component';

@NgModule({
  declarations: [
    MailOutboxComponent,
    BrandingLogosComponent, BrandingImagenesComponent, BrandingColoresComponent, BrandingCargaComponent,
    AdminDashboardComponent,
    UserManagementComponent,
    SlaConfigComponent,
    TeamManagementComponent,
    AreaManagementComponent,
    SucursalManagementComponent,
    CategoryManagementComponent,
    SlaManagementComponent,
    EscalationManagementComponent,
    TemplateManagementComponent,
    BrandingComponent,
    TicketTypeManagementComponent,
    AiConfigComponent,
    MicrosoftGraphConfigComponent,
    TelefoniaConfigComponent,
    TemasTemporadaComponent,
    SessionConfigComponent,
    MfaConfigComponent,
    AuditSistemaComponent,
    ChatConfigComponent,
    ReportManagementComponent,
    PagesSystemComponent
  ],
  imports: [SharedModule, NgChartsModule, RouterModule.forChild(ADMIN_ROUTES)],
  exports: [
    AdminDashboardComponent,
    UserManagementComponent,
    SlaConfigComponent,
    TeamManagementComponent,
    AreaManagementComponent,
    SucursalManagementComponent,
    CategoryManagementComponent,
    SlaManagementComponent,
    EscalationManagementComponent,
    TemplateManagementComponent,
    BrandingComponent,
    TicketTypeManagementComponent,
    AiConfigComponent,
    MicrosoftGraphConfigComponent,
    TelefoniaConfigComponent,
    TemasTemporadaComponent,
    SessionConfigComponent,
    MfaConfigComponent,
    AuditSistemaComponent,
    ChatConfigComponent,
    ReportManagementComponent,
    PagesSystemComponent
  ]
})
export class AdminModule {}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Catalog, RegisterRequest, User } from '../../models/user.model';
import { MonthlyEvaluation } from '../../models/dashboard.model';

export interface BrandingConfig {
  logoUrl: string;
  backgroundUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface SmtpConfigAdmin {
  idSmtp?: number;
  hostSmtp: string;
  portSmtp?: number;
  usernameSmtp?: string;
  passwordSmtp?: string;
  fromAddress?: string;
  displayName?: string;
  useTls?: boolean;
  enabledSmtp?: boolean;
}

export interface Area { idArea: number; nameArea: string; descriptionArea?: string; priorityLevel: number; statusArea: boolean; }
export interface Category { idCategory: number; nameCategory: string; descriptionCategory?: string; iconCategory?: string; colorCategory?: string; teamCategory?: SupportTeam; }
export interface SupportTeam { idTeam: number; nameTeam: string; descriptionTeam?: string; assignmentMethod: string; activeTeam: boolean; }
export interface SlaPolicy { idSlaPolicy: number; nameSlaPolicy: string; descriptionSlaPolicy?: string; responseTimeMinutes: number; resolutionTimeMinutes: number; activeSlaPolicy: boolean; }
export interface SlaRule { idSlaRule: number; slaPolicyId: number; areaId: number; priorityId: number; categoryId?: number; typeId?: number; activeSlaRule: boolean; }
export interface SlaEscalation { idEscalation: number; slaPolicyId: number; triggerPercentage: number; actionType: string; destinationTeamId?: number; destinationUserId?: number; notificationTemplateId?: number; }
export interface NotificationTemplate { idTemplate: number; nameTemplate: string; typeTemplate: string; subjectTemplate: string; bodyTemplate: string; activeTemplate: boolean; }
export interface TicketTypeConfig { id: number; name: string; description: string; }

export interface AiConfigAdmin {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface AiConfigAdminResponse {
  id: number;
  enabled: boolean;
  provider: string;
  model: string;
  apiKeyMasked: string | null;
  baseUrl: string;
}

export interface AuditEvent {
  idAudit: number;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: number | null;
  ipAddress: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private url = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  catalog(): Observable<Catalog> {
    return this.http.get<Catalog>(`${this.url}/catalog`);
  }

  getBranding(): Observable<BrandingConfig> {
    return this.http.get<BrandingConfig>(`${this.url}/branding`);
  }

  updateBranding(data: BrandingConfig): Observable<BrandingConfig> {
    return this.http.put<BrandingConfig>(`${this.url}/branding`, data);
  }

  uploadLogo(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/logo`, form);
  }

  uploadBackground(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/background`, form);
  }

  // Usuarios
  users(role?: string, status?: string, search?: string): Observable<User[]> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<User[]>(`${environment.apiUrl}/users`, { params });
  }

  createUser(data: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${environment.apiUrl}/users`, data);
  }

  updateUser(id: number, data: RegisterRequest): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}`, data);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${id}`);
  }

  setUserStatus(id: number, status: string): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${id}/status`, null,
      { params: { status } });
  }

  agents(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users/agents`);
  }

  // Áreas
  getAreas(): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.url}/areas`);
  }

  createArea(data: Partial<Area>): Observable<Area> {
    return this.http.post<Area>(`${this.url}/areas`, data);
  }

  updateArea(id: number, data: Partial<Area>): Observable<Area> {
    return this.http.put<Area>(`${this.url}/areas/${id}`, data);
  }

  deleteArea(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/areas/${id}`);
  }

  // Categorías
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.url}/categories`);
  }

  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.url}/categories`, data);
  }

  updateCategory(id: number, data: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.url}/categories/${id}`, data);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/categories/${id}`);
  }

  // Equipos
  getTeams(): Observable<SupportTeam[]> {
    return this.http.get<SupportTeam[]>(`${this.url}/teams`);
  }

  createTeam(data: Partial<SupportTeam>): Observable<SupportTeam> {
    return this.http.post<SupportTeam>(`${this.url}/teams`, data);
  }

  updateTeam(id: number, data: Partial<SupportTeam>): Observable<SupportTeam> {
    return this.http.put<SupportTeam>(`${this.url}/teams/${id}`, data);
  }

  deleteTeam(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/teams/${id}`);
  }

  addMemberToTeam(teamId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.url}/teams/${teamId}/members/${userId}`, {});
  }

  removeMemberFromTeam(teamId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/teams/${teamId}/members/${userId}`);
  }

  // SLA Policies
  getSlaPolicies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(`${this.url}/sla/policies`);
  }

  createSlaPolicy(data: Partial<SlaPolicy>): Observable<SlaPolicy> {
    return this.http.post<SlaPolicy>(`${this.url}/sla/policies`, data);
  }

  updateSlaPolicy(id: number, data: Partial<SlaPolicy>): Observable<SlaPolicy> {
    return this.http.put<SlaPolicy>(`${this.url}/sla/policies/${id}`, data);
  }

  deleteSlaPolicy(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/policies/${id}`);
  }

  // SLA Rules
  getSlaRules(): Observable<SlaRule[]> {
    return this.http.get<SlaRule[]>(`${this.url}/sla/rules`);
  }

  createSlaRule(data: Partial<SlaRule>): Observable<SlaRule> {
    return this.http.post<SlaRule>(`${this.url}/sla/rules`, data);
  }

  updateSlaRule(id: number, data: Partial<SlaRule>): Observable<SlaRule> {
    return this.http.put<SlaRule>(`${this.url}/sla/rules/${id}`, data);
  }

  deleteSlaRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/rules/${id}`);
  }

  // Escalations
  getEscalations(): Observable<SlaEscalation[]> {
    return this.http.get<SlaEscalation[]>(`${this.url}/sla/escalations`);
  }

  createEscalation(data: Partial<SlaEscalation>): Observable<SlaEscalation> {
    return this.http.post<SlaEscalation>(`${this.url}/sla/escalations`, data);
  }

  updateEscalation(id: number, data: Partial<SlaEscalation>): Observable<SlaEscalation> {
    return this.http.put<SlaEscalation>(`${this.url}/sla/escalations/${id}`, data);
  }

  deleteEscalation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/escalations/${id}`);
  }

  // Plantillas
  getTemplates(): Observable<NotificationTemplate[]> {
    return this.http.get<NotificationTemplate[]>(`${this.url}/templates`);
  }

  createTemplate(data: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return this.http.post<NotificationTemplate>(`${this.url}/templates`, data);
  }

  updateTemplate(id: number, data: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return this.http.put<NotificationTemplate>(`${this.url}/templates/${id}`, data);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/templates/${id}`);
  }

  // Tipos de ticket
  getTicketTypes(): Observable<TicketTypeConfig[]> {
    return this.http.get<TicketTypeConfig[]>(`${this.url}/ticket-types`);
  }

  createTicketType(data: Partial<TicketTypeConfig>): Observable<TicketTypeConfig> {
    return this.http.post<TicketTypeConfig>(`${this.url}/ticket-types`, data);
  }

  updateTicketType(id: number, data: Partial<TicketTypeConfig>): Observable<TicketTypeConfig> {
    return this.http.put<TicketTypeConfig>(`${this.url}/ticket-types/${id}`, data);
  }

  deleteTicketType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/ticket-types/${id}`);
  }

  // Evaluaciones
  evaluationsByMonth(month: string): Observable<MonthlyEvaluation[]> {
    return this.http.get<MonthlyEvaluation[]>(`${this.url}/evaluations`,
      { params: { month } });
  }

  generateEvaluations(month: string): Observable<MonthlyEvaluation[]> {
    return this.http.post<MonthlyEvaluation[]>(`${this.url}/evaluations/generate`, null,
      { params: { month } });
  }

  // ============================ SMTP ============================
  getSmtpConfig(): Observable<SmtpConfigAdmin> {
    return this.http.get<SmtpConfigAdmin>(`${this.url}/smtp`);
  }

  updateSmtpConfig(data: Partial<SmtpConfigAdmin>): Observable<SmtpConfigAdmin> {
    return this.http.put<SmtpConfigAdmin>(`${this.url}/smtp`, data);
  }

  testSmtp(options: { to: string; host: string; port: number; username: string; password: string; from: string; useTls: boolean }): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.url}/smtp/test`, options);
  }

  // ============================ CONFIGURACIÓN IA ============================
  getAiConfig(): Observable<AiConfigAdminResponse> {
    return this.http.get<AiConfigAdminResponse>(`${this.url}/ai-config`);
  }

  updateAiConfig(data: AiConfigAdmin): Observable<AiConfigAdminResponse> {
    return this.http.put<AiConfigAdminResponse>(`${this.url}/ai-config`, data);
  }

  getAuditLogs(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(`${this.url}/audit-logs`);
  }
}
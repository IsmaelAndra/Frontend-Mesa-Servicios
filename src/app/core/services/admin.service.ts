import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { catchError, retry, shareReplay, tap } from 'rxjs/operators';

/** Última configuración de marca recibida (logo, fondos, colores), por si la red falla al entrar. */
const CLAVE_MARCA = 'mesa_ayuda_branding';
import { environment } from '../../../environments/environment';
import { Catalog, RegisterRequest, Sucursal, User } from '../../models/user.model';
import { MonthlyEvaluation } from '../../models/dashboard.model';

export interface BrandingConfig {
  logoUrl: string;
  backgroundUrl: string;
  logoLoginUrl?: string;
  systemIconUrl?: string;
  reportLogoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  profileCoverUrl?: string;
  chatBackgroundUrl?: string;
  chatBackgroundLightUrl?: string;
  chatBackgroundDarkUrl?: string;
  /** Modo mantenimiento: deja la app en la pantalla de aviso. */
  maintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  maintenanceEta?: string;
  /** Logo e icono propios de la pantalla de aviso; si faltan, se usa la marca. */
  maintenanceLogoUrl?: string;
  maintenanceIcon?: string;
  maintenanceIconColor?: string;
  /** Pantalla de carga del arranque: AUTO usa el icono del sistema. */
  loadingMode?: 'AUTO' | 'IMAGE' | 'ICON';
  loadingImageUrl?: string;
  loadingIcon?: string;
  loadingBackgroundColor?: string;
  loadingTextColor?: string;
  loadingTitle?: string;
  loadingMessage?: string;
  loadingAnimation?:
    | 'SPINNER'
    | 'RING'
    | 'DOTS'
    | 'BARS'
    | 'BALL'
    | 'INFINITY'
    | 'PULSE'
    | 'NONE';
  /** Efecto aplicado al logo del splash, aparte del indicador. */
  loadingLogoEffect?:
    | 'NONE'
    | 'FADE'
    | 'FADE_IN'
    | 'SCALE_PULSE'
    | 'ZOOM'
    | 'FLOAT'
    | 'BOUNCE'
    | 'GLOW'
    | 'SHIMMER'
    | 'SWING'
    | 'SPIN';
  loadingProgress?: boolean;
  loadingTheme?: 'LIGHT' | 'DARK';
  loadingMinDurationMs?: number;
  /** Splash en modo "solo el logo": sin textos ni indicador de carga. */
  loadingSoloMarca?: boolean;
  /** Lado en px del logo del splash (48..256). */
  loadingImageSize?: number;
}

export type ChatBackgroundMode = 'light' | 'dark';

export interface Area { idArea: string; nameArea: string; descriptionArea?: string; priorityLevel: number; statusArea: boolean; iconArea?: string; colorArea?: string; }
export interface Category { idCategory: string; nameCategory: string; descriptionCategory?: string; iconCategory?: string; colorCategory?: string; teamCategory?: SupportTeam; }
export interface SupportTeam { idTeam: string; nameTeam: string; descriptionTeam?: string; assignmentMethod: string; activeTeam: boolean; iconTeam?: string; colorTeam?: string; }
export interface SlaPolicy { idSlaPolicy: string; nameSlaPolicy: string; descriptionSlaPolicy?: string; responseTimeMinutes: number; resolutionTimeMinutes: number; activeSlaPolicy: boolean; iconSlaPolicy?: string; colorSlaPolicy?: string; }
export interface SlaRule { idSlaRule: string; slaPolicyId: string; areaId: string; priorityId: string; categoryId?: string; typeId?: string; activeSlaRule: boolean; }
export interface SlaEscalation { idEscalation: string; slaPolicyId: string; triggerPercentage: number; actionType: string; destinationTeamId?: string; destinationUserId?: string; notificationTemplateId?: string; }
export interface NotificationTemplate { idTemplate: string; nameTemplate: string; typeTemplate: string; subjectTemplate: string; bodyTemplate: string; activeTemplate: boolean; recipientRule?: string; recipientEmail?: string | null; iconTemplate?: string; colorTemplate?: string; /** Imagen propia, para usarla en el HTML con [imagen] o [imagenUrl]. */ imageUrl?: string; }
export interface TicketTypeConfig { id: string; name: string; description: string; icon?: string; color?: string; }

/** Configuración global de asignación automática (tabla de fila única). */
export interface RoutingConfig {
  id: string;
  autoAssignEnabled: boolean;
  notifyUnassigned: boolean;
  updatedAtRoutingConfig?: string | null;
}

export interface ReportConfig {
  idReport: string;
  nameReport: string;
  titleReport: string;
  descriptionReport?: string | null;
  querySql: string;
  activeReport: boolean;
  iconReport?: string | null;
  colorReport?: string | null;
}

/** Cuerpo esperado por el backend al crear/editar un reporte personalizado (claves planas via Map). */
export interface ReportPayload {
  name: string;
  title: string;
  description?: string;
  querySql: string;
  active?: boolean;
  icon?: string;
  color?: string;
}

export interface SessionConfigAdmin {
  /** Minutos de vida del token de acceso. */
  sessionMinutes: number;
  /** Minutos antes del vencimiento en que se avisa al usuario. */
  warningMinutes: number;
  /** Si el frontend renueva el token automaticamente. */
  autoRenew: boolean;
  /** Si el cierre por inactividad esta activo. */
  idleEnabled: boolean;
  /** Minutos sin actividad antes de cerrar la sesion. */
  idleMinutes: number;
  /** Quien aplico el ultimo cambio. */
  updatedBy?: string;
  /** Ultima actualizacion, en ISO-8601. */
  updatedAt?: string;
}

/**
   * Interruptor global del doble factor (SUPER_ADMIN).
   */
export interface MfaSettingAdmin {
  mfaEnabled: boolean;
  issuer: string;
  /** Cuentas que ya tienen app configurada. */
  enrolledCount: number;
  /** Si el propio super administrador lo tiene puesto. */
  superAdminEnrolled: boolean;
}

/** Petición para activar o desactivar. El emisor solo se cambia si viene. */
export interface MfaSettingRequest {
  mfaEnabled: boolean;
  issuer?: string;
}

/**
   * Quien puede ver los acuses de lectura del chat (el doble check azul y el texto
 * "Leido por ..."). Los codigos los define el backend, asi que el selector se
 * construye con las opciones que devuelve el endpoint y no con una lista fija
 * aqui: si el backend anade un valor, aparece solo.
 */
export interface ChatConfigAdmin {
  readVisibleTo: string;
  showReadByNames: boolean;
  options: { valor: string; texto: string }[];
  updatedBy?: string;
}

/** Lo que necesita el chat para decidir si pinta el doble check. */
export interface MyReadVisibility {
  canSeeRead: boolean;
  showReadByNames: boolean;
}

export interface AiConfigAdmin {
        provider: string;
        model: string;
        apiKey?: string;
        baseUrl?: string;
        providerIcon?: string;
        enabled?: boolean;
        /** Reglas y comportamiento esperado que se inyectan en cada prompt. */
        rulesText?: string;
        /** Acciones habilitadas: SUMMARY, SUGGEST, CHAT. */
        enabledActions?: string;
        /** Consultas máximas por día (0 = sin límite). */
        dailyLimit?: number | null;
      }

export interface AiConfigAdminResponse {
        id: string;
        enabled: boolean;
        provider: string;
        model: string;
        /** Si hay clave configurada. El backend no la devuelve ni enmascarada. */
        apiKeyConfigured: boolean;
        baseUrl: string;
        providerIcon: string | null;
        rulesText: string;
        enabledActions: string;
        /** Consultas máximas por día (null = sin límite) y las usadas hoy. */
        dailyLimit: number | null;
        usedToday: number | null;
      }

export interface AuditEvent {
  idAudit: string;
  username: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface MicrosoftGraphConfigAdmin {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  grantType?: string;
  secretExpiresAt?: string | null;
  enabled?: boolean;
  syncIntervalMinutes?: number;
  mailEnabled?: boolean;
  mailFromAccount?: string;
}

export interface MicrosoftGraphConfigResponse {
  id: string | null;
  tenantId: string | null;
  clientId: string | null;
  clientSecretConfigured: boolean;
  scope: string;
  grantType: string;
  secretExpiresAt: string | null;
  enabled: boolean;
  syncIntervalMinutes: number;
  mailEnabled: boolean;
  mailFromAccount: string | null;
  lastSyncAt: string | null;
  updatedAt: string | null;
  status: 'CONNECTED' | 'INCOMPLETE' | 'DISABLED';
}

export interface GraphAuditItem {
  id: string;
  changedBy: number | null;
  changedByEmail: string | null;
  action: string;
  details: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface DailySummaryResponse {
  sent: number;
  recipients: string[];
  createdToday: number;
  resolvedToday: number;
  openTickets: number;
  unassignedTickets: number;
  criticalTickets: number;
  slaAtRisk: number;
  slaBreachedOpen: number;
}

/**
 * Los cuatro estados que tienen pantalla propia. Cada uno lleva su titulo,
 * mensaje, icono y color, porque el texto que sirve para un 404 no sirve para un
 * 500: el 500 tiene que decir que el equipo ya fue avisado y el 403 que el
 * permiso se puede solicitar.
 */
export interface ErrorPageText {
  title: string;
  message: string;
  icon: string;
  color: string;
}

/** Los cuatro estados juntos, tal cual los devuelve el backend. */
export interface ErrorPageTexts {
  error404Title: string;
  error404Message: string;
  error404Icon: string;
  error404Color: string;
  error403Title: string;
  error403Message: string;
  error403Icon: string;
  error403Color: string;
  error500Title: string;
  error500Message: string;
  error500Icon: string;
  error500Color: string;
  error503Title: string;
  error503Message: string;
  error503Icon: string;
  error503Color: string;
  /** Comunes a todas las páginas de aviso (opcionales: un backend antiguo no los manda). */
  errorButtonText?: string;
  errorShowCode?: boolean;
  errorShowPrivacy?: boolean;
}

/** Al guardar se manda el mismo contrato; se aliasa para dejar clara la intencion. */
export type ErrorPageTextsRequest = ErrorPageTexts;

export interface PrivacyPolicy {
  privacyTitle: string;
  privacyVersion: string;
  privacyContent: string;
  privacyContact: string;
  privacyEffective: string;
  /** true cuando el texto es del super administrador y el seed ya no lo toca. */
  edited: boolean;
}

export interface PrivacyPolicyRequest {
  privacyTitle: string;
  privacyVersion: string;
  privacyContent: string;
  privacyContact: string;
  privacyEffective: string;
}

/**
 * Agente disponible para asignar.
 *
 * <p>El backend devuelve solo esto y no el usuario completo: el listado se
 * restringe al personal porque lo consume el kanban, y antes cualquier usuario
 * con sesion obtenia por aqui la identificacion, el telefono y el UPN de
 * Microsoft de todo el personal.
 */
export interface AgentOption {
  idUser: string;
  displayName: string;
  /** Mismo nombre que en User, para que el emparejamiento existente siga funcionando. */
  corporateEmailUser: string;
  photoUrl: string | null;
  /** EN_LINEA, RECIENTE o DESCONECTADO. Lo pinta el kanban. */
  sessionState: string;
}

/**
 * El kanban mezcla en sus opciones al usuario con sesion, que puede ser un ADMIN
 * y por tanto no viene de /users/agents. Ese caso sigue siendo un User.
 */
export type AssignableAgent = AgentOption | User;

@Injectable({ providedIn: 'root' })
export class AdminService {
  private url = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  catalog(): Observable<Catalog> {
    return this.http.get<Catalog>(`${this.url}/catalog`);
  }

  /**
   * Configuración de marca. Si la primera petición falla (servidor reiniciándose,
   * red que tarda en conectar) se reintenta hasta 3 veces; antes la pantalla se
   * quedaba sin logo ni fondo hasta recargar. Si aun así falla, se usa la última
   * marca que se recibió en este navegador.
   */
  getBranding(): Observable<BrandingConfig> {
    // Varias piezas (app, guard de mantenimiento, login...) la piden al cargar:
    // durante unos segundos comparten la misma respuesta.
    const ahora = Date.now();
    if (!this.marcaCompartida || ahora - this.marcaDesde > 5000) {
      this.marcaDesde = ahora;
      this.marcaCompartida = this.pedirBranding().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.marcaCompartida;
  }

  private marcaCompartida?: Observable<BrandingConfig>;
  private marcaDesde = 0;

  private pedirBranding(): Observable<BrandingConfig> {
    return this.http.get<BrandingConfig>(`${this.url}/branding`).pipe(
      retry({
        count: 3,
        delay: (error: { status?: number }, intento: number) =>
          // Solo errores de red o del servidor; un 4xx no se arregla reintentando.
          !error?.status || error.status >= 500 ? timer(700 * intento) : throwError(() => error),
      }),
      tap((b) => {
        try {
          localStorage.setItem(CLAVE_MARCA, JSON.stringify(b));
        } catch {
          // sin almacenamiento disponible: no pasa nada
        }
      }),
      catchError((error) => {
        const guardada = this.brandingGuardado();
        return guardada ? of(guardada) : throwError(() => error);
      }),
    );
  }

  /** La última marca recibida, para pintar el logo y el fondo sin esperar a la red. */
  brandingGuardado(): BrandingConfig | null {
    try {
      const texto = localStorage.getItem(CLAVE_MARCA);
      return texto ? (JSON.parse(texto) as BrandingConfig) : null;
    } catch {
      return null;
    }
  }

  updateBranding(data: BrandingConfig): Observable<BrandingConfig> {
    this.marcaCompartida = undefined;
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

  uploadLogoLogin(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/logo-login`, form);
  }

  uploadSystemIcon(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/system-icon`, form);
  }

  /** Logo propio de la pantalla de mantenimiento. */
  uploadMaintenanceLogo(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/maintenance-logo`, form);
  }

  /** Imagen central de la pantalla de carga del arranque. */
  uploadLoadingImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/loading-image`, form);
  }

  uploadReportLogo(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/report-logo`, form);
  }

  uploadProfileCover(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/branding/profile-cover`, form);
  }

  uploadChatBackground(file: File, mode: ChatBackgroundMode): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    const params = new HttpParams().set('mode', mode);
    return this.http.post<{ url: string }>(`${this.url}/branding/chat-background`, form, { params });
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

  updateUser(id: string, data: RegisterRequest): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/${id}`, data);
  }

  /**
   * Guarda el perfil propio. No pide rol de administracion y no exige roleName
   * ni areaId, que es lo que hacia fallar a la ruta PUT /users/{id}.
   */
  updateMyProfile(data: {
    identificationUser?: string;
    phoneUser?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    /** Código del doble factor, si la cuenta lo tiene configurado. */
    codigoMfa?: string | null;
  }): Observable<User> {
    return this.http.put<User>(`${environment.apiUrl}/users/me`, data);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/users/${id}`);
  }

  setUserStatus(id: string, status: string): Observable<User> {
    return this.http.patch<User>(`${environment.apiUrl}/users/${id}/status`, null,
      { params: { status } });
  }

agents(): Observable<AgentOption[]> {
    return this.http.get<AgentOption[]>(`${environment.apiUrl}/users/agents`);
  }

  // Áreas
  // ============ SEDES ============

  /**
   * Catálogo de sedes. Es lo que consumen los selectores de persona y de
   * ticket nuevo.
   */
  getSucursales(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(`${this.url}/sucursales`);
  }

  createSucursal(data: Record<string, unknown>): Observable<Sucursal> {
    return this.http.post<Sucursal>(`${this.url}/sucursales`, data);
  }

  updateSucursal(id: string, data: Record<string, unknown>): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${this.url}/sucursales/${id}`, data);
  }

  deleteSucursal(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sucursales/${id}`);
  }

  getAreas(): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.url}/areas`);
  }

  createArea(data: Partial<Area>): Observable<Area> {
    return this.http.post<Area>(`${this.url}/areas`, data);
  }

  updateArea(id: string, data: Partial<Area>): Observable<Area> {
    return this.http.put<Area>(`${this.url}/areas/${id}`, data);
  }

  deleteArea(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/areas/${id}`);
  }

  // Categorías
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.url}/categories`);
  }

  createCategory(data: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.url}/categories`, this.categoryPayload(data));
  }

  updateCategory(id: string, data: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.url}/categories/${id}`, this.categoryPayload(data));
  }

  private categoryPayload(data: Partial<Category>): Record<string, unknown> {
    return {
      name: data.nameCategory ?? '',
      description: data.descriptionCategory ?? '',
      icon: data.iconCategory ?? '',
      color: data.colorCategory ?? '',
      teamId: data.teamCategory?.idTeam ?? null
    };
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/categories/${id}`);
  }

  // Equipos
  getTeams(): Observable<SupportTeam[]> {
    return this.http.get<SupportTeam[]>(`${this.url}/teams`);
  }

  createTeam(data: Partial<SupportTeam>): Observable<SupportTeam> {
    return this.http.post<SupportTeam>(`${this.url}/teams`, this.teamPayload(data));
  }

  updateTeam(id: string, data: Partial<SupportTeam>): Observable<SupportTeam> {
    return this.http.put<SupportTeam>(`${this.url}/teams/${id}`, this.teamPayload(data));
  }

  private teamPayload(data: Partial<SupportTeam>): Record<string, unknown> {
    return {
      name: data.nameTeam ?? '',
      description: data.descriptionTeam ?? '',
      method: data.assignmentMethod ?? 'ROUND_ROBIN',
      active: data.activeTeam ?? true,
      icon: data.iconTeam ?? '',
      color: data.colorTeam ?? ''
    };
  }

  deleteTeam(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/teams/${id}`);
  }

  addMemberToTeam(teamId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.url}/teams/${teamId}/members/${userId}`, {});
  }

  removeMemberFromTeam(teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/teams/${teamId}/members/${userId}`);
  }

  /** Configuración global de asignación automática (lectura: ADMIN, escritura: SUPER_ADMIN). */
  getRoutingConfig(): Observable<RoutingConfig> {
    return this.http.get<RoutingConfig>(`${this.url}/routing-config`);
  }

  updateRoutingConfig(data: Partial<RoutingConfig>): Observable<RoutingConfig> {
    return this.http.put<RoutingConfig>(`${this.url}/routing-config`, {
      autoAssignEnabled: data.autoAssignEnabled ?? true,
      notifyUnassigned: data.notifyUnassigned ?? false
    });
  }

  // SLA Policies
  getSlaPolicies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(`${this.url}/sla/policies`);
  }

  createSlaPolicy(data: Partial<SlaPolicy>): Observable<SlaPolicy> {
    return this.http.post<SlaPolicy>(`${this.url}/sla/policies`, this.slaPolicyPayload(data));
  }

  updateSlaPolicy(id: string, data: Partial<SlaPolicy>): Observable<SlaPolicy> {
    return this.http.put<SlaPolicy>(`${this.url}/sla/policies/${id}`, this.slaPolicyPayload(data));
  }

  /** El backend espera claves planas (name, responseMinutes, icon...), no los campos de la entidad. */
  private slaPolicyPayload(data: Partial<SlaPolicy>): Record<string, unknown> {
    return {
      name: data.nameSlaPolicy ?? '',
      description: data.descriptionSlaPolicy ?? '',
      responseMinutes: data.responseTimeMinutes ?? 0,
      resolutionMinutes: data.resolutionTimeMinutes ?? 0,
      active: data.activeSlaPolicy ?? true,
      icon: data.iconSlaPolicy ?? '',
      color: data.colorSlaPolicy ?? ''
    };
  }

  deleteSlaPolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/policies/${id}`);
  }

  // SLA Rules
  getSlaRules(): Observable<SlaRule[]> {
    return this.http.get<SlaRule[]>(`${this.url}/sla/rules`);
  }

  createSlaRule(data: Partial<SlaRule>): Observable<SlaRule> {
    return this.http.post<SlaRule>(`${this.url}/sla/rules`, this.slaRulePayload(data));
  }

  updateSlaRule(id: string, data: Partial<SlaRule>): Observable<SlaRule> {
    return this.http.put<SlaRule>(`${this.url}/sla/rules/${id}`, this.slaRulePayload(data));
  }

  /** El backend espera claves planas; null en categoría/tipo significa "todas/todos". */
  private slaRulePayload(data: Partial<SlaRule>): Record<string, unknown> {
    return {
      policyId: data.slaPolicyId ?? null,
      areaId: data.areaId ?? null,
      priorityId: data.priorityId ?? null,
      categoryId: data.categoryId ?? null,
      typeId: data.typeId ?? null,
      active: data.activeSlaRule ?? true
    };
  }

  deleteSlaRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/rules/${id}`);
  }

  // Escalations
  getEscalations(): Observable<SlaEscalation[]> {
    return this.http.get<SlaEscalation[]>(`${this.url}/sla/escalations`);
  }

  createEscalation(data: Partial<SlaEscalation>): Observable<SlaEscalation> {
    return this.http.post<SlaEscalation>(`${this.url}/sla/escalations`, this.escalationPayload(data));
  }

  updateEscalation(id: string, data: Partial<SlaEscalation>): Observable<SlaEscalation> {
    return this.http.put<SlaEscalation>(`${this.url}/sla/escalations/${id}`, this.escalationPayload(data));
  }

  /** El backend espera claves planas; null conserva el destino vacío. */
  private escalationPayload(data: Partial<SlaEscalation>): Record<string, unknown> {
    return {
      policyId: data.slaPolicyId ?? null,
      trigger: data.triggerPercentage ?? null,
      action: data.actionType ?? '',
      teamId: data.destinationTeamId ?? null,
      userId: data.destinationUserId ?? null,
      templateId: data.notificationTemplateId ?? null
    };
  }

  deleteEscalation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/sla/escalations/${id}`);
  }

  // Plantillas
  getTemplates(): Observable<NotificationTemplate[]> {
    return this.http.get<NotificationTemplate[]>(`${this.url}/templates`);
  }

  createTemplate(data: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return this.http.post<NotificationTemplate>(`${this.url}/templates`, data);
  }

  updateTemplate(id: string, data: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return this.http.put<NotificationTemplate>(`${this.url}/templates/${id}`, data);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/templates/${id}`);
  }

  /**
   * Sube la imagen de una plantilla. Se guarda en la zona pública porque el
   * correo se abre fuera del navegador, así que la etiqueta <img> necesita una
   * dirección pública y no un recurso protegido.
   */
  uploadTemplateImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${this.url}/templates/image`, form);
  }

  // Tipos de ticket
  getTicketTypes(): Observable<TicketTypeConfig[]> {
    return this.http.get<TicketTypeConfig[]>(`${this.url}/ticket-types`);
  }

  createTicketType(data: Partial<TicketTypeConfig>): Observable<TicketTypeConfig> {
    return this.http.post<TicketTypeConfig>(`${this.url}/ticket-types`, data);
  }

  updateTicketType(id: string, data: Partial<TicketTypeConfig>): Observable<TicketTypeConfig> {
    return this.http.put<TicketTypeConfig>(`${this.url}/ticket-types/${id}`, data);
  }

  deleteTicketType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/ticket-types/${id}`);
  }

  // ============================ REPORTES PERSONALIZADOS ============================
  getReports(): Observable<ReportConfig[]> {
    return this.http.get<ReportConfig[]>(`${this.url}/reports`);
  }

  createReport(data: ReportPayload): Observable<ReportConfig> {
    return this.http.post<ReportConfig>(`${this.url}/reports`, data);
  }

  updateReport(id: string, data: ReportPayload): Observable<ReportConfig> {
    return this.http.put<ReportConfig>(`${this.url}/reports/${id}`, data);
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/reports/${id}`);
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

  // ============================ MICROSOFT GRAPH ============================
  getMicrosoftGraphConfig(): Observable<MicrosoftGraphConfigResponse> {
    return this.http.get<MicrosoftGraphConfigResponse>(`${this.url}/microsoft-graph`);
  }

  updateMicrosoftGraphConfig(data: MicrosoftGraphConfigAdmin): Observable<MicrosoftGraphConfigResponse> {
    return this.http.put<MicrosoftGraphConfigResponse>(`${this.url}/microsoft-graph`, data);
  }

  testMicrosoftGraph(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.url}/microsoft-graph/test`, {});
  }

  testMicrosoftGraphEmail(to?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.url}/microsoft-graph/email-test`, { to: to || undefined });
  }

  getMicrosoftGraphAudit(): Observable<GraphAuditItem[]> {
    return this.http.get<GraphAuditItem[]>(`${this.url}/microsoft-graph/audit`);
  }

  // ============================ CONFIGURACION DE SESION ============================
  getSessionConfig(): Observable<SessionConfigAdmin> {
    return this.http.get<SessionConfigAdmin>(`${this.url}/session-config`);
  }

  updateSessionConfig(data: SessionConfigAdmin): Observable<SessionConfigAdmin> {
    return this.http.put<SessionConfigAdmin>(`${this.url}/session-config`, data);
  }

/**
   * Estado del doble factor.
   *
   * <p>`enrolledCount` viene porque activar esto afecta a todo el mundo a la vez:
   * un super administrador tiene que ver cuántos quedan sin app antes de dar el
   * interruptor, no después.
   */
  getMfaSetting(): Observable<MfaSettingAdmin> {
    return this.http.get<MfaSettingAdmin>(`${this.url}/mfa`);
  }

  updateMfaSetting(data: MfaSettingRequest): Observable<MfaSettingAdmin> {
    return this.http.post<MfaSettingAdmin>(`${this.url}/mfa`, data);
  }

  /** Códigos de recuperación de la cuenta con sesión. */
  getRecoveryCodes(): Observable<{ enrolled: boolean; restantes: number }> {
    return this.http.post<{ enrolled: boolean; restantes: number }>(
      `${this.url}/mfa/recovery-codes`, {}
    );
  }

  /** Genera códigos nuevos; los anteriores dejan de servir. */
  regenerateRecoveryCodes(): Observable<string[]> {
    return this.http.post<string[]>(`${this.url}/mfa/recovery-codes/generar`, {});
  }

  // ============================ CONFIGURACION DEL CHAT ============================
    getChatConfig(): Observable<ChatConfigAdmin> {
      return this.http.get<ChatConfigAdmin>(`${this.url}/chat-config`);
  }

  updateChatConfig(data: { readVisibleTo: string; showReadByNames: boolean }): Observable<ChatConfigAdmin> {
    return this.http.put<ChatConfigAdmin>(`${this.url}/chat-config`, data);
  }

  /**
   * Si el usuario actual puede ver los acuses de lectura. Lo consulta el chat, no
   * el admin: el backend ya decide si incluir los nombres o no, y esto solo le
   * dice al cliente si tiene que pintar el doble check.
   */
  getMyReadVisibility(): Observable<MyReadVisibility> {
    return this.http.get<MyReadVisibility>(`${this.url}/chat-config/mi-visibilidad`);
  }

// ============================ RESUMEN DIARIO ============================
    sendDailySummary(to?: string): Observable<DailySummaryResponse> {
      return this.http.post<DailySummaryResponse>(`${this.url}/daily-summary/send`, { to: to || undefined });
    }

    // ============================ PAGINAS DE ERROR Y PRIVACIDAD ============================
    getErrorTexts(): Observable<ErrorPageTexts> {
      return this.http.get<ErrorPageTexts>(`${environment.apiUrl}/pages/public/error-texts`);
    }

    getPrivacyPolicy(): Observable<PrivacyPolicy> {
      return this.http.get<PrivacyPolicy>(`${environment.apiUrl}/pages/public/privacy`);
    }

    updateErrorTexts(data: ErrorPageTextsRequest): Observable<ErrorPageTexts> {
      return this.http.put<ErrorPageTexts>(`${this.url}/error-pages`, data);
    }

    updatePrivacyPolicy(data: PrivacyPolicyRequest): Observable<PrivacyPolicy> {
      return this.http.put<PrivacyPolicy>(`${this.url}/privacy`, data);
    }
  }
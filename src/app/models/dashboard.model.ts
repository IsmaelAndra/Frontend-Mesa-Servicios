export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  criticalTickets: number;
  slaComplianceRate: number | null;
  avgResolutionHours: number | null;
  slaBreachedOpen: number;
  slaAtRisk: number;
  ticketsByStatus: Record<string, number>;
  ticketsByArea: Record<string, number>;
  ticketsByCategory: Record<string, number>;
  ticketsLast12Weeks: number[];
  // ---- Ampliación del tablero (los opcionales faltan si el backend es anterior) ----
  ticketsByPriority?: Record<string, number>;
  /** Etiqueta de cada semana ("6 oct"), en el orden de ticketsLast12Weeks. */
  weekLabels?: string[];
  resolvedLast12Weeks?: number[];
  /** El mismo indicador en el periodo anterior de igual duración; null sin datos. */
  prevTotalTickets?: number | null;
  prevResolvedTickets?: number | null;
  prevAvgResolutionHours?: number | null;
  prevSlaComplianceRate?: number | null;
  /** Abiertos por antigüedad: "< 1 día", "1-3 días", "3-7 días", "> 7 días". */
  backlogAging?: Record<string, number>;
  /** 7 filas (lunes a domingo) x 24 horas: tickets creados. */
  activityHeatmap?: number[][];
  avgSatisfaction?: number | null;
  ratingsCount?: number;
  agentLoad?: AgentLoad[];
  attention?: TicketAtencion[];
}

/** Carga de un agente en el periodo (solo la ve la administración). */
export interface AgentLoad {
  agentId: string;
  name: string;
  photoUrl: string | null;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionHours: number | null;
}

/** Ticket abierto que necesita atención por su SLA. */
export interface TicketAtencion {
  ticketId: string;
  ticketNumber?: number | null;
  title: string;
  priority: string;
  status: string;
  dueAt: string;
  breached: boolean;
  agentName: string | null;
}

export interface MonthlyEvaluation {
    idEvaluation: string;
    agentId: string;
    agentEmail: string;
    /** Nombre del agente, como se muestra en el chat y en los correos. */
    agentDisplayName?: string;
    /** Foto de perfil del agente, o cadena vacía si no tiene. */
    agentPhotoUrl?: string;
    /** Estado de sesión del agente, para el punto de presencia de la tabla. */
    agentSessionState?: string;
    evaluationMonth: string;
  ticketsClosed: number;
  avgResponseTimeMinutes: number | null;
  avgResolutionTimeMinutes: number | null;
  slaComplianceRate: number | null;
  avgRequirementsMet: number | null;
  avgOverallSatisfaction: number | null;
  satisfactionScore: number | null;
  supervisorRating?: number;
  supervisorComments?: string;
  status: string;
  createdAt: string;
}

export interface TicketEvent {
  seq: number;
  type: string;
  ticketId: string;
  /** Número visible del ticket ("#43"). */
  ticketNumber?: number | null;
  ticketTitle: string;
  status?: string | null;
  actorId: string;
  actorName: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  timestamp: string;
}

/** Avisa de que alguien está escribiendo en un ticket. */
export interface TypingEvent {
  ticketId: string;
  userId: string;
  displayName: string;
  at: string;
}

/**
 * Avisa de que alguien ha leido los mensajes de este ticket. No lleva la lista
 * de mensajes: el frontend vuelve a pedir la ultima pagina y recibe del servidor
 * los contadores y los nombres, de modo que el cliente no decide nada.
 */
export interface LecturaEvent {
  ticketId: string;
  userId: string;
  displayName: string;
  at: string;
}

/** Aviso de que llego una notificacion nueva al usuario conectado. */
export interface NotificationEvent {
  type: string;
  subject: string;
  ticketId: string | null;
  at: string;
}

export interface DashboardOperations {
  openTickets: number;
  unassignedTickets: number;
  criticalTickets: number;
  slaAtRisk: number;
  slaBreachedOpen: number;
  createdToday: number;
  resolvedToday: number;
  recentActivity: TicketEvent[];
}
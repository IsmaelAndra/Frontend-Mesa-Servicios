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
}

export interface MonthlyEvaluation {
  idEvaluation: number;
  agentId: number;
  agentEmail: string;
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
export interface Ticket {
  idTicket: number;
  titleTicket: string;
  descriptionTicket: string;
  user: string;
  agent: string | null;
  team: string | null;
  area: string;
  category: string;
  type: string | null;
  status: string;
  priority: string;
  priorityLevel: number;
  closingDateTicket: string | null;
  createdAtTicket: string;
  updatedAtTicket: string;
}

export interface TicketRequest {
  title: string;
  description: string;
  categoryId?: number;
  priorityId?: number;
  typeId?: number;
}

export interface TicketQuery {
  status?: string;
  priority?: string;
  category?: string;
  areaId?: number;
  agentId?: number;
  requesterId?: number;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface TicketPage {
  content: Ticket[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface Answer {
  idAnswer: number;
  messageAnswer: string;
  internalAnswer: boolean;
  user: string;
  createdAtAnswer: string;
}

export interface AnswerRequest {
  message: string;
  internal?: boolean;
}

export interface Attach {
  idAttach: number;
  fileNameAttach: string;
  storagePathAttach: string;
  sizeFileAttach: number;
  mimeTypeAttach: string;
  createdAtAttach: string;
  answerId: number | null;
}

export interface TicketType {
  id: number;
  name: string;
  description?: string;
}

export interface AuditLog {
  idAudit: number;
  actionType: string;
  user: string;
  oldValue: string;
  newValue: string;
  createdAtAudit: string;
}

export interface RatingRequest {
  requirementsMet: number;
  allRequirementsMet: boolean;
  responseTimeRating?: number;
  resolutionQuality?: number;
  agentCommunication?: number;
  overallSatisfaction?: number;
  comments?: string;
}

export interface Rating {
  idRating: number;
  ticketId: number;
  requirementsMet: number;
  allRequirementsMet: boolean;
  responseTimeRating?: number;
  resolutionQuality?: number;
  agentCommunication?: number;
  overallSatisfaction?: number;
  comments?: string;
  ratedAt: string;
}
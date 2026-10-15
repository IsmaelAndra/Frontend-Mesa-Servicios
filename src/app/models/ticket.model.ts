export interface Ticket {
  idTicket: string;
  userId?: string;
  titleTicket: string;
  descriptionTicket: string;
  user: string;
  userDisplayName?: string;
  userPhotoUrl?: string;
  userStatus?: string;
  /** Estado de sesión del solicitante: EN_LINEA | RECIENTE | DESCONECTADO. */
  userSessionState?: string;
  agent: string | null;
  team: string | null;
  area: string;
  /** Sede a la que corresponde el caso. */
  sucursal?: string;
  sucursalId?: string | null;
  category: string;
  type: string | null;
  status: string;
  priority: string;
  priorityLevel: number;
  closingDateTicket: string | null;
  createdAtTicket: string;
  updatedAtTicket: string;
  /** Número correlativo que ve la gente ("#43"); idTicket es la clave (uuid). */
  numberTicket?: number | null;
}

export interface TicketRequest {
  title: string;
  description: string;
  categoryId?: string;
  priorityId?: string;
  typeId?: string;
  /** Sede del caso; si no se manda, se toma la del solicitante. */
  sucursalId?: string;
  /** Solicitante cuando el personal abre el ticket a nombre de otra persona. */
  requesterId?: string;
}

export interface TicketQuery {
  status?: string;
  priority?: string;
  category?: string;
  areaId?: string;
  sucursalId?: string;
  agentId?: string;
  requesterId?: string;
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

/**
 * Página del hilo de respuestas. El backend las devuelve de la más reciente a
 * la más antigua, y el chat carga hacia atrás al subir el scroll.
 */
export interface AnswerPage {
  answers: Answer[];
  page: number;
  size: number;
  /** Si hay mensajes más antiguos que esta página. */
  hasMore: boolean;
  total: number;
}

export interface Answer {
  idAnswer: string;
  messageAnswer: string;
  internalAnswer: boolean;
  user: string;
  userDisplayName?: string;
  userPhotoUrl?: string;
  createdAtAnswer: string;
  /**
   * Estado de sesión de quien escribió el mensaje. Lo manda el backend porque
   * es el único que sabe quién tiene el SSE abierto: antes el frontend lo
   * deducía buscando el autor en la lista de agentes, en la ficha del
   * solicitante o en el titular, y a un ADMIN o SUPER_ADMIN que respondía le
   * salía "Desconectado" aunque estuviera conectado.
   */
  userSessionState?: string;
  /**
   * Si el usuario con sesión ya abrió este mensaje. El backend lo manda siempre,
   * también cuando el usuario no tiene permiso para ver los acuses: es un hecho
   * sobre sí mismo y no revela nada de terceros. Es lo que permite al chat poner
   * "Sin leer" en un mensaje ajeno mientras no se ha abierto, y quitar la
   * pastilla en cuanto se lee, sin inventar un recuento que no le corresponde.
   */
  readByMe?: boolean;
  /**
   * Cuántos participantes lo han leído, o null si el usuario actual no tiene
   * permiso para verlo. El null es lo que permite distinguir "nadie lo ha leído
   * todavía" de "no me dejan ver quién lo ha leído", y por eso no se rellena con
   * un cero en el cliente.
   */
  readCount?: number | null;
  /**
   * Nombres de quienes ya lo leyeron. Viene vacío si el usuario no tiene permiso,
   * o si el administrador desactivó mostrar los nombres y solo Enabled el recuento.
   */
  readBy?: string[];
  /** Cuándo se editó por última vez (null si nunca). El chat lo marca "editado". */
  editedAtAnswer?: string | null;
  /** Estaba sin leer por mí justo antes de abrir el hilo (separador "no leídos"). */
  unreadOnOpen?: boolean | null;
  /** Solo en el frontend: 'enviando' o 'fallido' mientras el mensaje está en vuelo. */
  state?: 'enviando' | 'fallido';
}

export interface AnswerRequest {
  message: string;
  internal?: boolean;
}

export interface Attach {
  idAttach: string;
  fileNameAttach: string;
  /** Ruta de descarga con permiso. Antes era la ruta del archivo en el servidor. */
  downloadUrl: string | null;
  sizeFileAttach: number;
  mimeTypeAttach: string;
  createdAtAttach: string;
  answerId: string | null;
}

export interface TicketType {
  id: string;
  name: string;
  description?: string;
}

export interface AuditLog {
  idAudit: string;
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
  idRating: string;
  ticketId: string;
  requirementsMet: number;
  allRequirementsMet: boolean;
  responseTimeRating?: number;
  resolutionQuality?: number;
  agentCommunication?: number;
  overallSatisfaction?: number;
  comments?: string;
  ratedAt: string;
}

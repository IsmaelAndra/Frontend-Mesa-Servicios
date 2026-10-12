/**
 * Modelo de la búsqueda global (GET /search).
 *
 * Cada grupo es una vista compacta de su entidad: el backend la recorta a lo
 * mínimo para localizar el destino y recorta también los grupos que el rol no
 * puede ver (llegan como lista vacía, nunca como null). Estos tipos son
 * voluntariamente pobres: el detalle real se resuelve al navegar a la ficha.
 */

export interface SearchTicketItem {
  idTicket: string;
  titleTicket: string;
  status: string;
  priority: string;
  createdAtTicket?: string;
  numberTicket?: number | null;
}

/** Persona: solicitante (USER) o agente (AGENT). Nunca trae datos privados. */
export interface SearchUserItem {
  idUser: string;
  displayName: string;
  corporateEmailUser: string;
  role: string;
  area?: string;
  photoUrl?: string;
}

export interface SearchTeamItem {
  idTeam: string;
  nameTeam: string;
  descriptionTeam?: string;
}

export interface SearchAreaItem {
  idArea: string;
  nameArea: string;
  descriptionArea?: string;
}

export interface SearchWorkflowItem {
  idWorkflow: string;
  nameWorkflow: string;
  statusWorkflow: string;
}

export interface GlobalSearchResponse {
  query: string;
  tickets: SearchTicketItem[];
  users: SearchUserItem[];
  agents: SearchUserItem[];
  teams: SearchTeamItem[];
  areas: SearchAreaItem[];
  workflows: SearchWorkflowItem[];
}
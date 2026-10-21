import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Answer, AnswerPage, AnswerRequest, Attach, AuditLog, Rating, RatingRequest,
  Ticket, TicketPage, TicketQuery, TicketRequest, TicketSla
} from '../../models/ticket.model';
import { SolicitanteResumen } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private url = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  search(query: TicketQuery = {}): Observable<TicketPage> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<TicketPage>(this.url, { params });
  }

  getById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.url}/${id}`);
  }

  myTickets(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.url}/mine`);
  }

  assigned(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.url}/assigned`);
  }

  create(data: TicketRequest): Observable<Ticket> {
    return this.http.post<Ticket>(this.url, data);
  }

  assign(id: string, agentId?: string, teamId?: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/assign`, { agentId, teamId });
  }

  changeStatus(id: string, statusName: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/status`, { statusName });
  }

  /**
   * Página del hilo. El backend pagina de la más reciente a la más antigua,
   * que es como se lee un chat: primero lo reciente y, al subir, lo anterior.
   */
  answersPage(id: string, page = 0, size = 20): Observable<AnswerPage> {
    return this.http.get<AnswerPage>(`${this.url}/${id}/answers`, {
      params: { page, size }
    });
  }

  addAnswer(id: string, data: AnswerRequest): Observable<Answer> {
    return this.http.post<Answer>(`${this.url}/${id}/answers`, data);
  }

  /** Corrige un mensaje propio (el backend solo lo permite los primeros 15 min). */
  editAnswer(id: string, answerId: string, message: string): Observable<Answer> {
    return this.http.put<Answer>(`${this.url}/${id}/answers/${answerId}`, { message });
  }

  /** Retira un mensaje propio (mismas reglas que editar). */
  deleteAnswer(id: string, answerId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}/answers/${answerId}`);
  }

  /** Avisa al backend de que se está escribiendo, para el indicador de los demás. */
  notifyTyping(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/typing`, {});
  }

  attachments(id: string): Observable<Attach[]> {
    return this.http.get<Attach[]>(`${this.url}/${id}/attachments`);
  }

  /**
 * Descarga el contenido de un adjunto.
 *
 * Va por HttpClient y no como enlace directo a propósito: el endpoint exige
 * sesión, y un <a href> no lleva la cabecera Authorization que añade el
 * interceptor, así que devolvería 401. Con responseType 'blob' el token viaja
 * en la petición y el archivo se guarda desde memoria.
 */
downloadAttachment(ticketId: string, attachmentId: string): Observable<Blob> {
  return this.http.get(
    `${this.url}/${ticketId}/attachments/${attachmentId}/content`,
    { responseType: 'blob' }
  );
}

uploadAttachment(id: string, file: File, answerId?: string): Observable<Attach> {
    const form = new FormData();
    form.append('file', file);
    let params = new HttpParams();
    if (answerId !== undefined && answerId !== null) params = params.set('answerId', String(answerId));
    return this.http.post<Attach>(`${this.url}/${id}/attachments`, form, { params });
  }

  audit(id: string): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.url}/${id}/audit`);
  }

  /** Plazos del SLA; null si el ticket no tiene (204). */
  sla(id: string): Observable<TicketSla | null> {
    return this.http.get<TicketSla | null>(`${this.url}/${id}/sla`);
  }

  rate(id: string, data: RatingRequest): Observable<Rating> {
    return this.http.post<Rating>(`${this.url}/${id}/rate`, data);
  }

  getRating(id: string): Observable<Rating> {
    return this.http.get<Rating>(`${this.url}/${id}/rating`);
  }

  solicitanteResumen(userId: string): Observable<SolicitanteResumen> {
    return this.http.get<SolicitanteResumen>(`${environment.apiUrl}/solicitantes/${userId}/resumen`);
  }
}
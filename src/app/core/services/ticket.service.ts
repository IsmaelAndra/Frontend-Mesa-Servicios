import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Answer, AnswerRequest, Attach, AuditLog, Rating, RatingRequest,
  Ticket, TicketPage, TicketQuery, TicketRequest
} from '../../models/ticket.model';

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

  getById(id: number): Observable<Ticket> {
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

  assign(id: number, agentId?: number, teamId?: number): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/assign`, { agentId, teamId });
  }

  changeStatus(id: number, statusName: string): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.url}/${id}/status`, { statusName });
  }

  answers(id: number): Observable<Answer[]> {
    return this.http.get<Answer[]>(`${this.url}/${id}/answers`);
  }

  addAnswer(id: number, data: AnswerRequest): Observable<Answer> {
    return this.http.post<Answer>(`${this.url}/${id}/answers`, data);
  }

  attachments(id: number): Observable<Attach[]> {
    return this.http.get<Attach[]>(`${this.url}/${id}/attachments`);
  }

  uploadAttachment(id: number, file: File, answerId?: number): Observable<Attach> {
    const form = new FormData();
    form.append('file', file);
    let params = new HttpParams();
    if (answerId !== undefined && answerId !== null) params = params.set('answerId', String(answerId));
    return this.http.post<Attach>(`${this.url}/${id}/attachments`, form, { params });
  }

  audit(id: number): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.url}/${id}/audit`);
  }

  rate(id: number, data: RatingRequest): Observable<Rating> {
    return this.http.post<Rating>(`${this.url}/${id}/rate`, data);
  }

  getRating(id: number): Observable<Rating> {
    return this.http.get<Rating>(`${this.url}/${id}/rating`);
  }
}
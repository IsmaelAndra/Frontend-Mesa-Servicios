import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { QuickReply, QuickReplyRequest } from '../../models/quick-reply.model';

/** Respuestas rápidas del chat (solo personal: agente o administrador). */
@Injectable({ providedIn: 'root' })
export class QuickReplyService {
  private url = `${environment.apiUrl}/quick-replies`;

  constructor(private http: HttpClient) {}

  listar(): Observable<QuickReply[]> {
    return this.http.get<QuickReply[]>(this.url);
  }

  crear(req: QuickReplyRequest): Observable<QuickReply> {
    return this.http.post<QuickReply>(this.url, req);
  }

  actualizar(id: string, req: QuickReplyRequest): Observable<QuickReply> {
    return this.http.put<QuickReply>(`${this.url}/${id}`, req);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}

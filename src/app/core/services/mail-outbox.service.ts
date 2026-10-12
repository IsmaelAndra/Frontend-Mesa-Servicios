import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CorreoEnCola, PaginaCorreos, ResumenColaCorreo } from '../../models/mail-outbox.model';

/** Panel de la cola de correo (solo SUPER_ADMIN). */
@Injectable({ providedIn: 'root' })
export class MailOutboxService {
  private url = `${environment.apiUrl}/admin/mail-outbox`;

  constructor(private http: HttpClient) {}

  resumen(): Observable<ResumenColaCorreo> {
    return this.http.get<ResumenColaCorreo>(`${this.url}/resumen`);
  }

  listar(estado: string, q: string, pagina: number, tamano: number): Observable<PaginaCorreos> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (estado) params = params.set('estado', estado);
    if (q.trim().length >= 2) params = params.set('q', q.trim());
    return this.http.get<PaginaCorreos>(this.url, { params });
  }

  reintentar(id: string): Observable<CorreoEnCola> {
    return this.http.post<CorreoEnCola>(`${this.url}/${id}/reintentar`, {});
  }

  cancelar(id: string): Observable<CorreoEnCola> {
    return this.http.post<CorreoEnCola>(`${this.url}/${id}/cancelar`, {});
  }

  reintentarFallidos(): Observable<{ reencolados: number }> {
    return this.http.post<{ reencolados: number }>(`${this.url}/reintentar-fallidos`, {});
  }
}

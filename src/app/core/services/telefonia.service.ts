import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Orden de llamada entre extensiones (backend: TelefoniaController). */
export interface Llamada {
  id: string;
  origen: string;
  destino: string;
  /** PENDIENTE | ENVIADA | REALIZADA | ERROR | VENCIDA */
  estado: string;
  error?: string | null;
  creada: string;
}

/**
 * Llamadas por la central Grandstream UCM. El backend deja la orden y el puente
 * de telefonía (servidor interno de la cooperativa) la ejecuta en la UCM.
 */
@Injectable({ providedIn: 'root' })
export class TelefoniaService {
  private readonly url = `${environment.apiUrl}/telefonia`;
  /** Si hay puente configurado: se pregunta una vez por sesión de la app. */
  private habilitada$?: Observable<boolean>;

  constructor(private http: HttpClient) {}

  habilitada(): Observable<boolean> {
    if (!this.habilitada$) {
      this.habilitada$ = this.http.get<{ habilitada: boolean }>(`${this.url}/estado`).pipe(
        map((r) => !!r?.habilitada),
        catchError(() => of(false)),
        shareReplay(1),
      );
    }
    return this.habilitada$;
  }

  llamarAlSolicitante(ticketId: string): Observable<Llamada> {
    return this.http.post<Llamada>(`${this.url}/tickets/${ticketId}/llamar`, {});
  }

  estado(id: string): Observable<Llamada> {
    return this.http.get<Llamada>(`${this.url}/llamadas/${id}`);
  }
}

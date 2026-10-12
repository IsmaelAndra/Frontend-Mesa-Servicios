import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../../models/notification.model';

/** Reporte tal como lo publica GET /reports/disponibles. */
export interface AvailableReport {
  id: string;
  nombre: string;
  titulo: string;
  descripcion?: string;
  icono?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private url = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  /**
   * Avisa de que el número de sin leer cambió.
   *
   * El navbar y la página de notificaciones son dos componentes distintos con
   * su propia copia de la lista. Antes, marcar como leída desde la página solo
   * actualizaba su copia local: al volver a la barra, el contador y el punto de
   * "sin leer" seguían como si nada, porque el navbar solo se recargaba al
   * llegar un evento por SSE. Con este aviso los dos se ponen al día.
   */
  private readonly unreadChanges = new Subject<void>();

  unreadChanged$(): Observable<void> {
    return this.unreadChanges.asObservable();
  }

  /** Notifica que hay que volver a pedir el contador y la lista. */
  notificarLectura(): void {
    this.unreadChanges.next();
  }

  myNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.url);
  }

  /** Marca una notificación concreta como leída en el backend */
  markAsRead(id: string): Observable<void> {
    return this.http.put<void>(`${this.url}/${id}/read`, {});
  }

  /** Marca todas las notificaciones del usuario como leídas en el backend */
  markAllAsRead(): Observable<void> {
    return this.http.put<void>(`${this.url}/read-all`, {});
  }

  /** Número de notificaciones sin leer, para el contador del navbar. */
  unreadCount(): Observable<{ unread: number }> {
    return this.http.get<{ unread: number }>(`${this.url}/unread-count`);
  }

  /** Reportos disponibles, los devuelve el backend para no fijarlos en el código. */
  availableReports(): Observable<AvailableReport[]> {
    return this.http.get<AvailableReport[]>(`${environment.apiUrl}/reports/disponibles`);
  }

downloadReport(id: string, format = 'PDF', params?: {
      from?: string;
      to?: string;
      typeId?: string;
      /** Sede por la que se acota el reporte; si se omite, son todas. */
      sucursalId?: string;
      orientacion?: string;
    }): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/custom/${id}`,
      { responseType: 'blob', params: { format, ...(params || {}) } as Record<string, string | number> });
  }
}
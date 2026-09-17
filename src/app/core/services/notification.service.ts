import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private url = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  myNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.url);
  }

  downloadReport(reportName: string, format = 'PDF', params?: {
    from?: string;
    to?: string;
    typeId?: number;
  }): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/${reportName}`,
      { responseType: 'blob', params: { format, ...(params || {}) } as any });
  }
}
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, MonthlyEvaluation } from '../../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private url = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  stats(status?: string, area?: string, category?: string, from?: string, to?: string): Observable<DashboardStats> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (area) params = params.set('area', area);
    if (category) params = params.set('category', category);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<DashboardStats>(`${this.url}/stats`, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private url = `${environment.apiUrl}/evaluations`;

  constructor(private http: HttpClient) {}

  mine(): Observable<MonthlyEvaluation[]> {
    return this.http.get<MonthlyEvaluation[]>(`${this.url}/mine`);
  }
}
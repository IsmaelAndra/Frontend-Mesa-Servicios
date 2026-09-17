import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TaskItem, TaskRequest, TaskStatus } from '../../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private url = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  findAll(status?: TaskStatus | ''): Observable<TaskItem[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<TaskItem[]>(this.url, { params });
  }

  getById(id: number): Observable<TaskItem> {
    return this.http.get<TaskItem>(`${this.url}/${id}`);
  }

  create(data: TaskRequest): Observable<TaskItem> {
    return this.http.post<TaskItem>(this.url, data);
  }

  update(id: number, data: TaskRequest): Observable<TaskItem> {
    return this.http.put<TaskItem>(`${this.url}/${id}`, data);
  }

  changeStatus(id: number, statusName: TaskStatus): Observable<TaskItem> {
    return this.http.patch<TaskItem>(`${this.url}/${id}/status`, { statusName });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
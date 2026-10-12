import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiAssistRequest {
  action: string;
  ticketId: string;
  instructions?: string;
}

export interface AiChatRequest {
  message: string;
  context?: string;
  session?: string;
}

export interface AiAssistResponse {
  content: string;
}

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  providerIcon: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private url = `${environment.apiUrl}/ai`;

  constructor(private http: HttpClient) {}

  assist(data: AiAssistRequest): Observable<AiAssistResponse> {
    return this.http.post<AiAssistResponse>(`${this.url}/assist`, data);
  }

  chat(message: string, context?: string, session?: string): Observable<AiAssistResponse> {
    return this.http.post<AiAssistResponse>(`${this.url}/chat`, { message, context, session });
  }

  config(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.url}/config`);
  }
}
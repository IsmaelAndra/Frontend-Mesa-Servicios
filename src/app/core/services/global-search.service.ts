import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GlobalSearchResponse } from '../../models/search.model';

/**
 * Búsqueda global.
 *
 * Dos responsabilidades separadas: el sujeto que avisa a la lupa de "abrerse"
 * desde cualquier sitio (navbar, atajo Ctrl+K) y la llamada HTTP a GET /search.
 * El modal vive en {@code GlobalSearchComponent}, que es quien se suscribe.
 */
@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private readonly url = `${environment.apiUrl}/search`;

  private openSubject = new Subject<void>();

  /** Aviso de que se quiere abrir el buscador. */
  get open$(): Observable<void> {
    return this.openSubject.asObservable();
  }

  constructor(private http: HttpClient) {}

  /** Pide que el buscador se abra. */
  open(): void {
    this.openSubject.next();
  }

  /** Busca un término contra todos los catálogos a la vez. */
  buscar(q: string): Observable<GlobalSearchResponse> {
    const params = new HttpParams().set('q', q);
    return this.http.get<GlobalSearchResponse>(this.url, { params });
  }
}
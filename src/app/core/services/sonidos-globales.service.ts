import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { NotificationUrgency } from '../constants/notification-presentation';
import { NotificationSoundService, SonidosGlobales } from './notification-sound.service';

export type AmbitoSonido = 'URGENCIA' | 'TIPO';

/** Una fila de GET /sounds (sin el audio). */
export interface SonidoServidor {
  scope: AmbitoSonido;
  key: string;
  urgency: NotificationUrgency | null;
  hasAudio: boolean;
  fileName: string | null;
  updatedAt: string;
}

/**
 * Sonidos de las notificaciones configurados por el SUPER_ADMIN para todos.
 *
 * <p>Antes se guardaban en el localStorage de quien los configuraba: solo le
 * sonaban a él y un MP3 de 1 MB llenaba el almacenamiento del navegador. Ahora
 * viven en el servidor; aquí se descargan los audios (con la sesión, como
 * blob) y se entregan a NotificationSoundService, que es quien suena.
 */
@Injectable({ providedIn: 'root' })
export class SonidosGlobalesService {
  private readonly http = inject(HttpClient);
  private readonly sonido = inject(NotificationSoundService);
  private readonly base = `${environment.apiUrl}`;

  /** URLs blob: creadas, para liberarlas al recargar. */
  private urls: string[] = [];

  /** Filas tal como vienen del servidor (para la pantalla de sonidos). */
  filas: SonidoServidor[] = [];

  /** Descarga la configuración y sus audios y la aplica. Nunca falla: sin red, tonos de siempre. */
  cargar(): Observable<void> {
    return this.http.get<SonidoServidor[]>(`${this.base}/sounds`).pipe(
      switchMap((filas) => {
        const conAudio = filas.filter((f) => f.hasAudio);
        if (!conAudio.length) {
          return of({ filas, conAudio, audios: [] as (string | null)[] });
        }
        return forkJoin(
          conAudio.map((f) =>
            this.http
              .get(`${this.base}/sounds/${f.scope}/${encodeURIComponent(f.key)}/audio`, {
                params: { v: f.updatedAt || '' },
                responseType: 'blob',
              })
              .pipe(
                map((blob) => URL.createObjectURL(blob)),
                catchError(() => of(null)),
              ),
          ),
        ).pipe(map((audios) => ({ filas, audios, conAudio })));
      }),
      map((r) => {
        const anteriores = this.urls;
        this.urls = [];
        const globales: SonidosGlobales = { tipos: {}, urgencias: {} };
        const audioDe = new Map<SonidoServidor, string | null>();
        r.conAudio.forEach((f, i) => {
          const url = r.audios[i] ?? null;
          audioDe.set(f, url);
          if (url) this.urls.push(url);
        });
        for (const f of r.filas) {
          const audio = audioDe.get(f) ?? null;
          if (f.scope === 'URGENCIA') {
            if (audio) {
              globales.urgencias[f.key as NotificationUrgency] = { audio, fileName: f.fileName };
            }
          } else {
            globales.tipos[f.key] = { urgency: f.urgency, audio, fileName: f.fileName };
          }
        }
        this.filas = r.filas;
        this.sonido.aplicarGlobales(globales);
        anteriores.forEach((u) => URL.revokeObjectURL(u));
      }),
      catchError(() => of(undefined)),
    );
  }

  // ============================ solo SUPER_ADMIN ============================

  subirAudio(ambito: AmbitoSonido, clave: string, archivo: File): Observable<void> {
    const datos = new FormData();
    datos.append('file', archivo, archivo.name);
    return this.http
      .post(`${this.base}/admin/sounds/${ambito}/${encodeURIComponent(clave)}/audio`, datos)
      .pipe(switchMap(() => this.cargar()));
  }

  quitarAudio(ambito: AmbitoSonido, clave: string): Observable<void> {
    return this.http
      .delete(`${this.base}/admin/sounds/${ambito}/${encodeURIComponent(clave)}/audio`)
      .pipe(switchMap(() => this.cargar()));
  }

  cambiarUrgencia(clave: string, urgencia: NotificationUrgency | null): Observable<void> {
    return this.http
      .put(`${this.base}/admin/sounds/TIPO/${encodeURIComponent(clave)}`, { urgency: urgencia })
      .pipe(switchMap(() => this.cargar()));
  }

  restablecer(ambito: AmbitoSonido, clave: string): Observable<void> {
    return this.http
      .delete(`${this.base}/admin/sounds/${ambito}/${encodeURIComponent(clave)}`)
      .pipe(switchMap(() => this.cargar()));
  }

  restablecerTodo(): Observable<void> {
    return this.http.delete(`${this.base}/admin/sounds`).pipe(switchMap(() => this.cargar()));
  }
}

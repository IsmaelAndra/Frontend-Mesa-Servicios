import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { PanelTemas, TemaActual, TemaTemporada } from '../../models/tema-temporada.model';
import { NotificationSoundService } from './notification-sound.service';

/**
 * Tema de temporada (Halloween, Navidad...).
 *
 * <p>Pide al servidor qué tema toca hoy y pone {@code data-temporada="navidad"}
 * en {@code <html>}; los adornos son CSS en {@code styles.css} bajo ese
 * atributo, así que añadir un tema es añadir su bloque de CSS. Los colores de
 * marca no cambian. Cada persona puede ocultar las decoraciones (se recuerda en
 * su navegador).
 */
@Injectable({ providedIn: 'root' })
export class TemaTemporadaService {
  private static readonly CLAVE_OCULTAR = 'ocultarDecoraciones';

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly sonido = inject(NotificationSoundService);
  private readonly base = environment.apiUrl;

  private readonly temaSubject = new BehaviorSubject<TemaActual | null>(null);
  private readonly ocultasSubject = new BehaviorSubject<boolean>(TemaTemporadaService.leerOcultas());

  /** Tema de hoy, o null. Se emite aunque la persona haya ocultado los adornos. */
  readonly tema$ = this.temaSubject.asObservable();

  /** Tema que se debe pintar: null si no hay o si la persona ocultó los adornos. */
  readonly temaVisible$: Observable<TemaActual | null> = this.temaSubject.pipe(
    map((t) => (this.ocultasSubject.value ? null : t)),
  );

  get tema(): TemaActual | null {
    return this.temaSubject.value;
  }

  get ocultas(): boolean {
    return this.ocultasSubject.value;
  }

  get ocultas$(): Observable<boolean> {
    return this.ocultasSubject.asObservable();
  }

  /** Pide el tema de hoy y lo aplica. Sin red o sin tema, la app sigue normal. */
  cargar(): Observable<TemaActual | null> {
    return this.http
      .get<TemaActual | null>(`${this.base}/pages/public/tema-temporada`)
      .pipe(
        map((t) => (t && t.code ? t : null)),
        catchError(() => of(null)),
        tap((t) => this.aplicar(t)),
      );
  }

  /** Muestra u oculta los adornos para esta persona. */
  setOcultas(valor: boolean): void {
    this.ocultasSubject.next(valor);
    try {
      localStorage.setItem(TemaTemporadaService.CLAVE_OCULTAR, valor ? '1' : '0');
    } catch {
      // Sin almacenamiento: vale para esta sesión.
    }
    this.aplicar(this.temaSubject.value);
  }

  aplicar(tema: TemaActual | null): void {
    this.temaSubject.next(tema);
    const html = this.document.documentElement;
    const visible = !!tema && !this.ocultasSubject.value;
    if (visible) {
      html.setAttribute('data-temporada', tema!.code.toLowerCase());
    } else {
      html.removeAttribute('data-temporada');
    }
    // Los sonidos de la temporada suenan mientras se ven sus adornos; quien
    // los oculta vuelve a los sonidos de siempre.
    this.sonido.setTemporada(visible ? tema!.code : null);
  }

  // ============================ administración (SUPER_ADMIN) ============================

  panel(): Observable<PanelTemas> {
    return this.http.get<PanelTemas>(`${this.base}/admin/temas-temporada`);
  }

  configurar(enabled: boolean, forcedCode: string | null): Observable<PanelTemas> {
    return this.http
      .put<PanelTemas>(`${this.base}/admin/temas-temporada/config`, { enabled, forcedCode })
      .pipe(tap((p) => this.aplicar(p.actual)));
  }

  actualizar(t: TemaTemporada): Observable<TemaTemporada> {
    return this.http.put<TemaTemporada>(`${this.base}/admin/temas-temporada/${t.id}`, {
      name: t.name,
      active: t.active,
      startMonth: t.startMonth,
      startDay: t.startDay,
      endMonth: t.endMonth,
      endDay: t.endDay,
      greeting: t.greeting,
    });
  }

  subirImagen(id: string, tipo: 'fondo' | 'logo', archivo: File): Observable<TemaTemporada> {
    const datos = new FormData();
    datos.append('file', archivo, archivo.name);
    return this.http.post<TemaTemporada>(`${this.base}/admin/temas-temporada/${id}/imagen/${tipo}`, datos);
  }

  quitarImagen(id: string, tipo: 'fondo' | 'logo'): Observable<TemaTemporada> {
    return this.http.delete<TemaTemporada>(`${this.base}/admin/temas-temporada/${id}/imagen/${tipo}`);
  }

  private static leerOcultas(): boolean {
    try {
      return localStorage.getItem(TemaTemporadaService.CLAVE_OCULTAR) === '1';
    } catch {
      return false;
    }
  }
}

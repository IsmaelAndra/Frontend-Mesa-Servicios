import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, finalize, throwError } from 'rxjs';
import { catchError, shareReplay, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  /**
   * Refresco en curso, compartido por todas las peticiones que reciben un 401
   * en el mismo instante.
   *
   * Antes solo había una bandera booleana. Con dos 401 a la vez (la app dispara
   * varias peticiones en paralelo al abrir una pantalla: el kanban del agente
   * son 7 GET, y la ficha de ticket encadena 4), la segunda veía la bandera a
   * true y reintentaba enseguida, todavía con el token caducado. Recibía otro
   * 401 y caía en expireSession(): el usuario era expulsado de la sesión de
   * forma intermitente y sin motivo aparente.
   *
   * Ahora la segunda petición se engancha a este mismo Observable y espera a
   * que termine, en lugar de competir con él.
   */
  private refreshInFlight: Observable<unknown> | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase();
    // Estas rutas no deben intentar renovar la sesión al recibir un 401: se
    // los puntos de entrada y de salida, donde un fallo significa
    // otra cosa. Se comparan por fragmento, así que da igual el prefijo.
if (url.includes('/auth/login') || url.includes('/auth/register')
        || url.includes('/auth/refresh') || url.includes('/auth/logout')
        || url.includes('/auth/change-password') || url.includes('/auth/forgot-password')
        || url.includes('/auth/reset-password')) {
        // change-password exige sesión: sin el Bearer el backend respondía 401 y
        // la contraseña no se podía cambiar, ni siquiera la inicial obligatoria.
        // Se manda el token, pero sigue sin renovar ante un 401.
        const actual = this.authService.getToken();
        if (actual && url.includes('/auth/change-password')) {
          req = req.clone({ setHeaders: { Authorization: `Bearer ${actual}` } });
        }
        return next.handle(this.conCredenciales(req));
      }
  
      const token = this.authService.getToken();
      if (token) {
        req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      }
  
      return next.handle(this.conCredenciales(req)).pipe(
        catchError((error) => this.handleUnauthorized(req, next, error))
      );
    }
  
    /**
     * Añade las credenciales y el token CSRF.
     *
     * <p>El refresh token ya no está en localStorage sino en una cookie HttpOnly,
     * que el navegador NO envía si la petición no lleva credenciales. Por eso
     * withCredentials no es opcional: sin él, /auth/refresh llegaría sin cookie y
     * el usuario se quedaría fuera de su propia sesión a los quince minutos.
     *
     * <p>La cabecera X-XSRF-TOKEN es el segundo envío: el backend compara lo que
     * llega aquí contra la cookie mesa_xsrf, que sí es legible desde JavaScript.
     * Una página de otro dominio puede provocar que el navegador envíe las
     * cookies, pero no puede leer esa segunda para copiarla.
     */
    private conCredenciales(req: HttpRequest<unknown>): HttpRequest<unknown> {
      const headers: Record<string, string> = {};
      const csrf = this.leerCsrf();
      if (csrf) {
        headers['X-XSRF-TOKEN'] = csrf;
      }
      return req.clone({ withCredentials: true, setHeaders: headers });
    }
  
    private leerCsrf(): string {
      if (typeof document === 'undefined' || !document.cookie) return '';
      for (const parte of document.cookie.split(';')) {
        const eq = parte.indexOf('=');
        if (eq > 0 && parte.slice(0, eq).trim() === 'mesa_xsrf') {
          return decodeURIComponent(parte.slice(eq + 1).trim());
        }
      }
      return '';
    }

  private handleUnauthorized(
    req: HttpRequest<unknown>,
    next: HttpHandler,
    error: unknown
  ): Observable<HttpEvent<unknown>> {
    const httpError = error as { status?: number };
    if (httpError.status !== 401) {
      return throwError(() => error);
    }

    return this.renovarToken().pipe(
      switchMap(() => this.retryAfterRefresh(req, next)),
      catchError(() => this.expireSession())
    );
  }

  /**
   * Devuelve el refresco en curso, o lo lanza si no había ninguno. Con
   * shareReplay solo hay una llamada real al endpoint por vez, y el
   * `finalize` va antes del share para ejecutarse una única vez, al terminar
   * la petición, y no cuando se da de baja cada suscriptor.
   */
  private renovarToken(): Observable<unknown> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.authService.refreshSession().pipe(
        finalize(() => { this.refreshInFlight = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.refreshInFlight;
  }

  private retryAfterRefresh(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    if (!token) {
      return this.expireSession();
    }
    // El reintento también necesita credenciales: si la petición original iba con
    // cookie y el reintento no, se pierde.
    return next.handle(this.conCredenciales(
      req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    )).pipe(
      catchError((retryError: unknown) => {
        const e = retryError as { status?: number };
        if (e.status === 401) {
          return this.expireSession();
        }
        return throwError(() => retryError);
      })
    );
  }

  private expireSession(): Observable<never> {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
    return throwError(() => new Error('Sesión expirada'));
  }
}
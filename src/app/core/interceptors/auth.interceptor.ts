import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, finalize, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshing = false;

  constructor(private authService: AuthService, private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url.toLowerCase();
    if (url.includes('/auth/login') || url.includes('/auth/register')
        || url.includes('/auth/refresh') || url.includes('/auth/logout')) {
      return next.handle(req);
    }

    const token = this.authService.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }

    return next.handle(req).pipe(
      catchError((error) => this.handleUnauthorized(req, next, error))
    );
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

    if (this.refreshing) {
      return this.retryAfterRefresh(req, next);
    }

    this.refreshing = true;
    return this.authService.refreshSession().pipe(
      switchMap(() => this.retryAfterRefresh(req, next)),
      finalize(() => { this.refreshing = false; })
    );
  }

  private retryAfterRefresh(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    if (!token) {
      return this.expireSession();
    }
    return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
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
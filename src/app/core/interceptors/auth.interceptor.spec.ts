import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

/**
 * Dos 401 en el mismo instante, que es lo normal al abrir una pantalla: el
 * kanban del agente dispara siete GET seguidos y la ficha de ticket encadena
 * cuatro. Con el interceptor anterior, la segunda petición no esperaba al
 * refresco en curso, reintentaba con el token viejo, recibía otro 401 y
 * expulsaba al usuario. Estos tests fijan que solo haya UNA llamada al refresco
 * y que la segunda petición espere a su resultado.
 */
describe('AuthInterceptor', () => {
  let refreshCalls: number;
  let logoutCalls: number;
  let navigateCalls: number;
  let interceptor: AuthInterceptor;
  let authStub: any;
  let routerStub: any;

  /** Token que se devuelve tras refrescar; cambia para que se note el reintento. */
  let currentToken: string;

  beforeEach(() => {
    refreshCalls = 0;
    logoutCalls = 0;
    navigateCalls = 0;
    currentToken = 'token-caducado';

    authStub = {
      getToken: () => currentToken,
      refreshSession: () => {
        refreshCalls++;
        currentToken = 'token-nuevo';
        return of({ token: 'token-nuevo' });
      },
      logout: () => { logoutCalls++; }
    };
    routerStub = { navigate: () => { navigateCalls++; } };

    TestBed.configureTestingModule({
      providers: [
        AuthInterceptor,
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: routerStub }
      ]
    });
    interceptor = TestBed.inject(AuthInterceptor);
  });

  /** Responde 401 siempre que la petición lleve el token caducado. */
  function handlerQueCaduca() {
    return (req: HttpRequest<any>) => {
      const auth = req.headers.get('Authorization');
      if (auth === 'Bearer token-nuevo') {
        return of(new HttpResponse({ status: 200, body: 'ok' }));
      }
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    };
  }

  it('renueva el token y reintenta la petición una sola vez', () => {
    // `unknown` y no `string | null`: la asignación ocurre dentro de un callback
    // y TypeScript la seguiría estrechando a null en la aserción.
    let resultado: unknown = null;
    interceptor
      .intercept(new HttpRequest('GET', '/api/tickets'), { handle: handlerQueCaduca() } as any)
      .subscribe((e: any) => { resultado = e.body; });

    expect(refreshCalls).toBe(1);
    expect(logoutCalls).toBe(0);
    expect(resultado).toBe('ok');
  });

  it('con dos 401 simultáneos solo llama una vez al refresco y NO expulsa al usuario', () => {
    const manejador = handlerQueCaduca();
    const next = { handle: manejador } as any;

    interceptor.intercept(new HttpRequest('GET', '/api/tickets'), next).subscribe({ error: () => {} });
    interceptor.intercept(new HttpRequest('GET', '/api/dashboard/stats'), next).subscribe({ error: () => {} });

    // El fallo era que la segunda petición competía con el refresco en curso,
    // así que terminaba en logout() y en un salto a la pantalla de login.
    expect(refreshCalls).toBe(1);
    expect(logoutCalls).toBe(0);
    expect(navigateCalls).toBe(0);
  });

  it('la segunda petición espera al refresco en vez de reintentar con el token viejo', () => {
    // El refresco se resuelve a mano para poder observar el estado intermedio.
    const refresco = new Subject<any>();
    authStub.refreshSession = () => { refreshCalls++; return refresco.asObservable(); };

    const manejador = handlerQueCaduca();
    const next = { handle: manejador } as any;
    const vistos: string[] = [];

    interceptor.intercept(new HttpRequest('GET', '/api/tickets'), next)
      .subscribe({ next: (e: any) => vistos.push('primera:' + e.body), error: () => vistos.push('primera:error') });
    interceptor.intercept(new HttpRequest('GET', '/api/calendar/events'), next)
      .subscribe({ next: (e: any) => vistos.push('segunda:' + e.body), error: () => vistos.push('segunda:error') });

    // Antes de resolver el refresco, ninguna ha reintentado todavía.
    expect(vistos).toEqual([]);

    currentToken = 'token-nuevo';
    refresco.next({ token: 'token-nuevo' });
    refresco.complete();

    expect(vistos).toEqual(['primera:ok', 'segunda:ok']);
    expect(logoutCalls).toBe(0);
  });

  it('expulsa la sesión si el refresco falla', () => {
    authStub.refreshSession = () => { refreshCalls++; return throwError(() => new Error('sin red')); };

    interceptor
      .intercept(new HttpRequest('GET', '/api/tickets'), { handle: handlerQueCaduca() } as any)
      .subscribe({ error: () => {} });

    expect(logoutCalls).toBe(1);
    expect(navigateCalls).toBe(1);
  });

  it('no intenta refrescar en las rutas de autenticación', () => {
    const rutas = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/auth/change-password',
      '/api/auth/forgot-password'
    ];
    for (const url of rutas) {
      const handler: any = { handle: () => throwError(() => new HttpErrorResponse({ status: 401 })) };
      interceptor
        // Esta versión de Angular exige el body en el constructor para POST.
        .intercept(new HttpRequest('POST', url, null), handler)
        .subscribe({ error: () => {} });
    }
    expect(refreshCalls).toBe(0);
  });

  it('un error que no es 401 se propaga sin tocar la sesión', () => {
    let capturado: unknown = null;
    interceptor
      .intercept(
        new HttpRequest('GET', '/api/tickets'),
        { handle: () => throwError(() => new HttpErrorResponse({ status: 500 })) } as any
      )
      .subscribe({ error: (e: unknown) => { capturado = e; } });

    expect((capturado as HttpErrorResponse).status).toBe(500);
    expect(refreshCalls).toBe(0);
    expect(logoutCalls).toBe(0);
  });

  it('change-password lleva el Bearer (sin él el backend respondía 401)', () => {
    currentToken = 'token-vigente';
    let cabecera: string | null = null;
    const handler: any = {
      handle: (req: HttpRequest<any>) => {
        cabecera = req.headers.get('Authorization');
        return of(new HttpResponse({ status: 200 }));
      }
    };
    interceptor
      .intercept(new HttpRequest('POST', '/api/auth/change-password', {}), handler)
      .subscribe();
    expect(cabecera as string | null).toBe('Bearer token-vigente');
  });

  it('login y logout siguen yendo sin Bearer', () => {
    currentToken = 'token-vigente';
    const vistas: (string | null)[] = [];
    const handler: any = {
      handle: (req: HttpRequest<any>) => {
        vistas.push(req.headers.get('Authorization'));
        return of(new HttpResponse({ status: 200 }));
      }
    };
    interceptor.intercept(new HttpRequest('POST', '/api/auth/login', {}), handler).subscribe();
    interceptor.intercept(new HttpRequest('POST', '/api/auth/logout', {}), handler).subscribe();
    expect(vistas).toEqual([null, null]);
  });
});

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from '../../../environments/environment';
import {
  AuthRequest,
  AuthResponse,
  MfaChallengeResponse,
  RegisterRequest,
  User
} from '../../models/user.model';

/**
 * ¿La respuesta del backend es un desafío del doble factor o una sesión?
*
  * <p>Se decide por la presencia de `status`, que solo viene en el desafío, y no
  * por `token`, porque un token podría venir vacío y entonces se trataría como
  * sesión cuando no lo es.
  */
function esDesafioMfa(
  res: AuthResponse | MfaChallengeResponse | null
): res is MfaChallengeResponse {
  return !!res && typeof (res as MfaChallengeResponse).status === 'string';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
private readonly TOKEN_KEY = 'mesa_ayuda_token';
    /**
     * Clave antigua del refresh token. Se conserva SOLO para borrarla: si alguien
     * tiene la app abierta desde antes de este cambio, su localStorage todavía
     * tiene el token de 30 días ahí expuesto y hay que quitarlo.
     */
    private readonly REFRESH_KEY_LEGADO = 'mesa_ayuda_refresh';
  private readonly PWD_FLAG_KEY = 'mesa_ayuda_must_change';
  private readonly EXPIRES_KEY = 'mesa_ayuda_expires_at';
  private readonly WARNING_KEY = 'mesa_ayuda_warning_minutes';
  private readonly AUTORENEW_KEY = 'mesa_ayuda_auto_renew';
  private readonly IDLE_ENABLED_KEY = 'mesa_ayuda_idle_enabled';
  private readonly IDLE_MINUTES_KEY = 'mesa_ayuda_idle_minutes';
  private readonly IDLE_LAST_KEY = 'mesa_ayuda_idle_last';
  private readonly jwtHelper = new JwtHelperService();
  private currentUser = new BehaviorSubject<User | null>(null);

  /**
   * Milisegundos que le quedan al token de acceso, actualizado cada segundo.
   * El navbar lo usa para avisar antes de que caduque la sesion.
   */
  private remainingMs = new BehaviorSubject<number>(0);

  /**
   * Milisegundos desde la ultima actividad del usuario. Es la sesion por
   * inactividad: el token no caduca a los 15 minutos fijo, sino que se cuenta
   * desde el ultimo uso real. El contador del navbar muestra este valor.
   */
  private idleRemainingMs = new BehaviorSubject<number>(0);

  /**
   * Eventos que cuentan como actividad. mousemove dispara muchas veces por
   * segundo, asi que se filtra por intervalo abajo: sin eso el navegador se
   * pasa la vida ejecutando el handler.
   */
  private readonly ACTIVIDAD_EVENTOS = [
    'mousedown', 'keydown', 'scroll', 'touchstart', 'click'
  ] as const;
  private readonly ACTIVIDAD_MIN_MS = 30_000;
  private ultimoRegistroActividad = 0;
  private idleListenerPuesto = false;

  constructor(private http: HttpClient) {
    // La sesión puede seguir viva entre recargas: el reloj se reanuda con el
    // expirado que quedó guardado, para que el contador no aparezca en cero.
    this.tick();
  }

  /**
   * Restaura la sesión guardada en localStorage al arrancar la app.
   * Si el access token expiró pero hay refresh token vigente, renueva la sesión;
   * si el token sigue vigente, hidrata el usuario. No desloguea ante fallos
   * transitorios (red, 5xx), solo ante un refresh genuinamente inválido.
   */
restoreSession(): Promise<void> {
      return new Promise<void>((resolve) => {
        const token = this.getToken();
        // Antes se miraba el refresh token de localStorage para saber si había
        // sesión. Ya no es accesible desde aquí, así que la pregunta correcta es
        // otra: ¿queda cookie? Si no hay token de acceso ni cookie, no hay sesión.
        if (!token && !this.tieneCookieRefresh()) {
          resolve();
          return;
        }
        if (token && !this.jwtHelper.isTokenExpired(token)) {
          this.hydrateFromToken(resolve);
          return;
        }
        // Token caducado o ausente pero con cookie: se intenta renovar. Con la
        // cookie dentro, un refresh fallido significa que la sesión ya no vale.
        if (this.tieneCookieRefresh()) {
          this.refreshSession().subscribe({
            next: () => this.hydrateFromToken(resolve),
            error: () => {
              this.logout();
              resolve();
            }
          });
          return;
        }
        resolve();
      });
    }

  private hydrateFromToken(done: () => void): void {
    this.currentUser.next(this.userFromToken());
    this.me().subscribe({
      next: (u) => this.currentUser.next(u),
      // Si me() falla (red/backend), se mantiene la sesión iniciada con el token;
      // un 401 real lo resuelve el interceptor (refresh o logout).
      error: () => undefined
    });
    done();
  }

  private userFromToken(): User {
    const token = this.getToken();
    const decoded = token
      ? (this.jwtHelper.decodeToken(token) as Record<string, unknown>)
      : {};
    return {
      idUser: '',
      identificationUser: '',
      corporateEmailUser: (decoded['sub'] as string) || '',
      phoneUser: '',
      statusUser: 'ACTIVE',
      role: ((decoded['roles'] as string) || '').replace('ROLE_', ''),
      area: '',
      createdAtUser: ''
    };
  }

/**
   * Intenta iniciar sesión.
   *
   * <p>El backend puede responder de dos maneras y hay que distinguirlas antes de
   * tocar el almacenamiento: o devuelve la sesión, o devuelve un desafío del
   * doble factor y todavía no hay nada guardado. Si se tratara lo segundo como si
   * fuera una sesión, se guardaría un token inexistente y el usuario se quedaría
   * en una pantalla que parece iniciada pero no lo está.
   */
   login(credentials: AuthRequest): Observable<AuthResponse | MfaChallengeResponse> {
     return this.http.post<AuthResponse | MfaChallengeResponse>(
       `${environment.apiUrl}/auth/login`, credentials
     ).pipe(
       tap((res) => {
         if (esDesafioMfa(res)) {
           this.desafioMfa = res;
         } else {
           this.storeSession(res as AuthResponse);
         }
       })
     );
   }

   /** Desafío pendiente de confirmar, si lo hay. */
   private desafioMfa: MfaChallengeResponse | null = null;

   get mfaPendiente(): MfaChallengeResponse | null {
     return this.desafioMfa;
   }

   /**
    * Olvida el desafío pendiente.
    *
    * <p>Se llama al abandonar la pantalla. No es solo limpieza de interfaz: si el
    * usuario vuelve al login y entra otra vez, el componente leería el desafío
    * viejo y enseñaría un QR que ya no corresponde al secreto que se le acaba de
    * generar, y el código que teclee no valdría nunca.
    */
   limpiarDesafioMfa(): void {
     this.desafioMfa = null;
   }

   /** ¿La respuesta del login fue un desafío en vez de una sesión? */
   static esDesafio(res: AuthResponse | MfaChallengeResponse | null): res is MfaChallengeResponse {
     return esDesafioMfa(res);
   }

   /**
    * Confirma el segundo factor.
    *
    * <p>Aquí es donde por fin se reciben los tokens. Se manda el mismo desafío
    * que devolvió el login: el backend lo tiene marcado como de un solo uso y no
    * vale dos veces.
    */
   confirmarMfa(codigo: string, codigoRecuperacion?: string, recordar = true): Observable<AuthResponse> {
     const desafio = this.desafioMfa;
     if (!desafio) {
       return throwError(() => new Error('No hay ningún desafío pendiente'));
     }
     // recordar: el backend deja el equipo recordado 30 días (cookie) y no vuelve
     // a pedir el código en él.
     const cuerpo: Record<string, string | boolean> = { challenge: desafio.challenge, recordar };
     if (codigoRecuperacion) {
       cuerpo['codigoRecuperacion'] = codigoRecuperacion;
     } else {
       cuerpo['codigo'] = codigo;
     }
     return this.http.post<AuthResponse>(
       `${environment.apiUrl}/auth/mfa/confirm`, cuerpo
     ).pipe(
       tap((res) => {
         this.desafioMfa = null;
         this.storeSession(res);
       })
     );
   }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((res) => this.storeSession(res)));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  /**
   * Confirma el enlace del correo y fija la contraseña.
   *
   * <p>Va sin el interceptor de refresco a propósito: quien llega aquí todavía
   * no tiene sesión, y reintentar solo impediría ver el error real de un enlace
   * caducado.
   */
  resetPassword(token: string, nuevaPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/reset-password`,
      { token, nuevaPassword });
  }

  /**
   * Si la cuenta tiene el doble factor activo y configurado: entonces los
   * cambios sensibles (contraseña, datos personales) piden el código de la app.
   */
  pideCodigoMfa(): Observable<boolean> {
    return this.http
      .get<{ mfaEnabled: boolean; enrolled: boolean }>(`${environment.apiUrl}/auth/mfa/estado`)
      .pipe(
        map((e) => !!e?.mfaEnabled && !!e?.enrolled),
        catchError(() => of(false)),
      );
  }

  me(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/users/me`);
  }

  /**
   * Cambia la contraseña. El backend invalida todos los tokens anteriores (de
   * este y de otros dispositivos) y devuelve una sesión nueva para este, que se
   * guarda aquí; la cookie del refresh nuevo llega con la respuesta.
   */
  changePassword(currentPassword: string, newPassword: string, codigoMfa?: string): Observable<AuthResponse | null> {
    return this.http
      .post<AuthResponse | null>(`${environment.apiUrl}/auth/change-password`,
        { currentPassword, newPassword, codigoMfa: codigoMfa || null })
      .pipe(tap((res) => { if (res?.token) this.storeSession(res); }));
  }

/**
   * Renueva la sesión.
   *
   * <p>No manda el refresh token en el cuerpo: viaja en una cookie HttpOnly que
   * el navegador adjunta solo. Por eso la petición va con `withCredentials`, y por
   * eso la respuesta ya no trae `refreshToken` (el backend lo pone en la cookie).
   */
  refreshSession(): Observable<AuthResponse> {
    if (!this.tieneCookieRefresh()) {
      return throwError(() => new Error('Sin refresh token'));
    }
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {},
      { withCredentials: true, headers: this.csrfHeader() })
      .pipe(tap((res) => this.storeSession(res)));
  }

  /**
   * El token CSRF es la cookie que el backend deja sin HttpOnly precisamente
   * para poder leerla. Va en la cabecera y el servidor la compara.
   */
  private csrfHeader(): { [k: string]: string } {
    const token = this.leerCookie('mesa_xsrf');
    return token ? { 'X-XSRF-TOKEN': token } : {};
  }

  private leerCookie(nombre: string): string {
    if (typeof document === 'undefined' || !document.cookie) return '';
    for (const parte of document.cookie.split(';')) {
      const eq = parte.indexOf('=');
      if (eq > 0 && parte.slice(0, eq).trim() === nombre) {
        return decodeURIComponent(parte.slice(eq + 1).trim());
      }
    }
    return '';
  }

  /**
   * Si queda cookie de refresco.
   *
   * <p>Se mira la cookie y no localStorage porque es la que decide si el backend
   * podrá renovar. Solo sirve como guarda rápida para no disparar un 401 inútil.
   */
  /**
   * Si hay sesión renovable. Se mira la cookie CSRF, que el backend emite y
   * borra a la vez que la de refresh. La de refresh es HttpOnly y JavaScript no
   * puede leerla nunca: antes se miraba esa, la comprobación daba siempre falso,
   * y la sesión se cerraba al caducar el token en vez de renovarse.
   */
  private tieneCookieRefresh(): boolean {
    return !!this.leerCookie('mesa_xsrf');
  }

  logout(): void {
    // El logout también viaja por cookie. No se puede revocar "a ciegas" si no
    // hay sesión: la petición se hace igual para que el backend borre la cookie.
    this.http.post(`${environment.apiUrl}/auth/logout`, {},
      { withCredentials: true, headers: this.csrfHeader() })
      .pipe(catchError(() => of(void 0)))
      .subscribe();
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * El refresh token ya no es accesible desde JavaScript, por diseño.
   *
   * <p>Se mantiene el método porque hay código que lo consulta para decidir si
   * hay sesión, y devolver siempre null es lo correcto: si algo intentara usarlo
   * como si fuera un token, fallaría en vez de filtrarlo.
   */
  getRefreshToken(): string | null {
    return null;
  }

  mustChangePassword(): boolean {
    if (!this.isAuthenticated()) return false;
    return localStorage.getItem(this.PWD_FLAG_KEY) === '1';
  }

  clearMustChangePassword(): void {
    localStorage.removeItem(this.PWD_FLAG_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.jwtHelper.isTokenExpired(token);
  }

  getRole(): string {
    const token = this.getToken();
    if (!token) return '';
    const decoded = this.jwtHelper.decodeToken(token) as { roles: string };
    return decoded?.roles?.replace('ROLE_', '') || '';
  }

  /**
   * Roles con los que cuenta el usuario para menús y rutas. El jefe de área
   * (AREA_MANAGER) es, fuera de Activos, un usuario más: crea y sigue sus
   * tickets como un USER. Sin esto solo veía "Activos" en el menú.
   */
  rolesEfectivos(): string[] {
    const rol = this.getRole();
    return rol === 'AREA_MANAGER' ? ['AREA_MANAGER', 'USER'] : rol ? [rol] : [];
  }

  /** Usuario final (USER o jefe de área): ve solo sus tickets. */
  esUsuarioFinal(): boolean {
    const rol = this.getRole();
    return rol === 'USER' || rol === 'AREA_MANAGER';
  }

  getEmail(): string {
    const token = this.getToken();
    if (!token) return '';
    const decoded = this.jwtHelper.decodeToken(token) as { email?: string; sub?: string };
    return decoded?.email || decoded?.sub || '';
  }

  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  /**
   * Usuario actual de forma sincrona. Se usa donde no se puede esperar al
   * observable, como el modal de alta de actividades, que necesita preseleccionar
   * al responsable.
   */
  currentUserSnapshot(): User | null {
    return this.currentUser.value;
  }

  /** Milisegundos restantes del token de acceso. */
  get sessionRemaining$(): Observable<number> {
    return this.remainingMs.asObservable();
  }

  sessionRemainingMs(): number {
    return this.remainingMs.value;
  }

  /** Minutos de configuracion a partir de los cuales se avisa al usuario. */
  warningMinutes(): number {
    const v = Number(localStorage.getItem(this.WARNING_KEY));
    return Number.isFinite(v) && v > 0 ? v : 5;
  }

  autoRenew(): boolean {
    return localStorage.getItem(this.AUTORENEW_KEY) !== '0';
  }

  /**
   * Cuando se agota el tiempo se intenta renovar una sola vez, para que el
   * usuario no pierda lo que estaba escribiendo. Si el refresh falla, el
   * interceptor lo resuelve y termina la sesion.
   */
  renewIfNeeded(): void {
    if (!this.autoRenew() || this.renewing) return;
    const restante = this.remainingMs.value;
    if (restante > this.warningMinutes() * 60_000) return;

    this.renewing = true;
    this.refreshSession().subscribe({
      next: () => {
        this.renewing = false;
      },
      error: () => {
        this.renewing = false;
      }
    });
  }

  private renewing = false;

  /**
   * Arranca el reloj de la sesion. Se llama una sola vez desde el componente
   * raíz; mientras el token siga vivo va descontando y avisa al navbar.
   */
  startSessionClock(): void {
    if (this.clockStarted) return;
    this.clockStarted = true;

    this.ponerEscuchaActividad();
    this.tick();
    this.clock = setInterval(() => this.tick(), 1000);
  }

  private clockStarted = false;
  private clock?: ReturnType<typeof setInterval>;

  /**
   * Escucha actividad del usuario para reiniciar el reloj de inactividad.
   * No se usa mousemove porque se dispara de forma continua al mover el mouse.
   */
  private ponerEscuchaActividad(): void {
    if (this.idleListenerPuesto || typeof window === 'undefined') return;
    this.idleListenerPuesto = true;
    for (const evento of this.ACTIVIDAD_EVENTOS) {
      window.addEventListener(evento, this.onActividad, { passive: true });
    }
  }

  private readonly onActividad = (): void => {
    const ahora = Date.now();
    if (ahora - this.ultimoRegistroActividad < this.ACTIVIDAD_MIN_MS) return;
    this.ultimoRegistroActividad = ahora;
    if (!this.idleHabilitado()) return;
    localStorage.setItem(this.IDLE_LAST_KEY, String(ahora));
    this.tick();
  };

  private quitarEscuchaActividad(): void {
    if (!this.idleListenerPuesto || typeof window === 'undefined') return;
    for (const evento of this.ACTIVIDAD_EVENTOS) {
      window.removeEventListener(evento, this.onActividad);
    }
    this.idleListenerPuesto = false;
  }

  /** Si el cierre por inactividad esta activo (lo decide el administrador). */
  idleHabilitado(): boolean {
    return localStorage.getItem(this.IDLE_ENABLED_KEY) !== '0';
  }

  /** Minutos de inactividad configurados, para mostrarlo en el aviso. */
  idleMinutos(): number {
    const v = Number(localStorage.getItem(this.IDLE_MINUTES_KEY));
    return Number.isFinite(v) && v > 0 ? v : 15;
  }

  /** Milisegundos restantes de inactividad, para el contador del navbar. */
  get idleRemaining$(): Observable<number> {
    return this.idleRemainingMs.asObservable();
  }

  /** Reinicia el reloj de inactividad a mano (boton "seguir trabajando"). */
  reiniciarInactividad(): void {
    localStorage.setItem(this.IDLE_LAST_KEY, String(Date.now()));
    this.tickIdle();
  }

  private tick(): void {
    const expira = Number(localStorage.getItem(this.EXPIRES_KEY));
    if (!expira) {
      this.remainingMs.next(0);
      this.tickIdle();
      return;
    }
    const restante = Math.max(0, expira - Date.now());
    this.remainingMs.next(restante);
    this.renewIfNeeded();
    this.tickIdle();
  }

  /**
   * Calcula el tiempo sin actividad y cierra la sesion si se paso del limite.
   * Se separa de tick() para que el cierre por inactividad sea su propia regla
   * y no dependa de que el token de acceso se este renovando.
   */
  private tickIdle(): void {
    if (!this.idleHabilitado()) {
      this.idleRemainingMs.next(0);
      return;
    }
    const ultima = Number(localStorage.getItem(this.IDLE_LAST_KEY));
    const ahora = Date.now();
    if (!ultima) {
      // Todavia no hay marca de actividad: se arranca el reloj desde ahora.
      localStorage.setItem(this.IDLE_LAST_KEY, String(ahora));
      this.idleRemainingMs.next(this.idleMinutos() * 60_000);
      return;
    }
    const restante = this.idleMinutos() * 60_000 - (ahora - ultima);
    this.idleRemainingMs.next(Math.max(0, restante));
    if (restante <= 0) {
      this.cerrarPorInactividad();
    }
  }

  /**
   * Cierra la sesion por inactividad. Se descarta el refresh token para que el
   * logout no intente revocarlo por red: la sesion ya se dio por terminada.
   */
  private cerrarPorInactividad(): void {
    this.clearSession();
    this.logoutLocalPorInactividad = true;
  }

  private logoutLocalPorInactividad = false;

  /** Permite que la UI avise de que se cerro por inactividad, no por el usuario. */
  consumeLogoutPorInactividad(): boolean {
    const v = this.logoutLocalPorInactividad;
    this.logoutLocalPorInactividad = false;
    return v;
  }

private storeSession(res: AuthResponse): void {
      localStorage.setItem(this.TOKEN_KEY, res.token);
      // El refresh token ya no se guarda: viene en cookie HttpOnly. Se borra la
      // clave vieja por si esta sesión venía de una versión anterior.
      localStorage.removeItem(this.REFRESH_KEY_LEGADO);
      localStorage.removeItem('mesa_refresh');
    if (res.mustChangePassword) {
      localStorage.setItem(this.PWD_FLAG_KEY, '1');
    } else {
      localStorage.removeItem(this.PWD_FLAG_KEY);
    }

    // Momento exacto de expiracion, para el contador de la sesion.
    if (res.expiresInSeconds != null) {
      localStorage.setItem(
        this.EXPIRES_KEY,
        String(Date.now() + res.expiresInSeconds * 1000)
      );
    } else if (res.token) {
      const decoded = this.jwtHelper.decodeToken(res.token) as { exp?: number };
      if (decoded?.exp) {
        localStorage.setItem(this.EXPIRES_KEY, String(decoded.exp * 1000));
      }
    }
    if (res.warningMinutes != null) {
      localStorage.setItem(this.WARNING_KEY, String(res.warningMinutes));
    }
    if (res.autoRenew != null) {
      localStorage.setItem(this.AUTORENEW_KEY, res.autoRenew ? '1' : '0');
    } else {
      localStorage.removeItem(this.AUTORENEW_KEY);
    }
    // Politica de inactividad: el login es donde el backend la comunica.
    if (res.idleEnabled != null) {
      localStorage.setItem(this.IDLE_ENABLED_KEY, res.idleEnabled ? '1' : '0');
    }
    if (res.idleMinutes != null) {
      localStorage.setItem(this.IDLE_MINUTES_KEY, String(res.idleMinutes));
    }
    // Cada login arranca un reloj de inactividad nuevo.
    localStorage.setItem(this.IDLE_LAST_KEY, String(Date.now()));
    this.logoutLocalPorInactividad = false;
    this.tick();
    this.currentUser.next({
      idUser: res.userId,
      identificationUser: '',
      corporateEmailUser: res.email,
      phoneUser: '',
      // Provisional: se reemplaza abajo con el dato real del perfil, porque el
      // login no informa el estado de la cuenta ni el de la sesión.
      statusUser: 'ACTIVE',
      role: res.role,
      area: res.area,
      createdAtUser: new Date().toISOString()
    });

    this.hidratarPerfil();
  }

  /**
   * Trae el perfil completo para conocer el estado real de la cuenta y de la
   * sesión. Antes se fabricaba con statusUser 'ACTIVE' fijo, así que una cuenta
   * desactivada por el admin seguía apareciendo como activa.
   */
  private hidratarPerfil(): void {
    this.me().subscribe({
      next: (u) => this.currentUser.next(u),
      error: () => undefined
    });
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    // La cookie la borra el backend en /auth/logout; desde aquí no se puede,
    // y no hace falta intentarlo.
    localStorage.removeItem(this.REFRESH_KEY_LEGADO);
    localStorage.removeItem(this.PWD_FLAG_KEY);
    localStorage.removeItem(this.EXPIRES_KEY);
    localStorage.removeItem(this.WARNING_KEY);
    localStorage.removeItem(this.AUTORENEW_KEY);
    localStorage.removeItem(this.IDLE_LAST_KEY);
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = undefined;
      this.clockStarted = false;
    }
    this.quitarEscuchaActividad();
    this.remainingMs.next(0);
    this.idleRemainingMs.next(0);
    this.currentUser.next(null);
  }
}
import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { Router } from "@angular/router";
import { Subject, Subscription, interval, takeUntil } from "rxjs";
import { AuthService } from "../../../../core/services/auth.service";
import { AdminService } from "../../../../core/services/admin.service";
import { NotificationService } from "../../../../core/services/notification.service";
  import { NotificationSoundService } from "../../../../core/services/notification-sound.service";
import { SseService } from "../../../../core/services/sse.service";
import { ThemeService } from "../../../../core/services/theme.service";
import { ToastService } from "../../../../core/services/toast.service";
import { GlobalSearchService } from "../../../../core/services/global-search.service";
import { Notification } from "../../../../models/notification.model";
import { User } from "../../../../models/user.model";
import { environment } from "../../../../../environments/environment";
import {
  notificationColor,
  notificationIcon,
  notificationTarget,
} from "../../../../core/constants/notification-presentation";
import {
  metaSesion,
  estadoDesdeConexion,
  SESION_PUNTO_NAVBAR,
  type SessionState,
} from "../../../../core/utils/session-presence.util";

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.css"],
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Output() toggleSidebar = new EventEmitter<void>();

  logoUrl = "";
  role = "";
  email = "";
  isAdmin = false;
  isSuperAdmin = false;
  user: User | null = null;
  isDark = false;
  sseStatus: "connecting" | "connected" | "closed" = "closed";

  /** Tiempo que le queda al token, en formato "mm:ss" o "1h 05m". */
  sesionRestante = "";
  /** true cuando ya se entró en el margen de aviso configurado. */
  sesionPorVencer = false;
  sesionRenovando = false;

  /**
   * Tiempo sin actividad antes de que se cierre la sesión, en "mm:ss". Es lo
   * que se muestra al usuario: la sesión no muere a los 15 minutos fijo sino
   * que cuenta desde el último uso real, así que el contador baja solo mientras
   * el usuario está ahí y se reinicia en cuanto toca algo.
   */
  inactividadRestante = "";
  inactividadPorVencer = false;
  inactividadRenovando = false;
  /** Margen de aviso para la inactividad: el último quinto del tiempo. */
  private readonly AVISO_INACTIVIDAD = 0.2;

  // Notificaciones
  notifications: Notification[] = [];
  notificationsCount = 0;
  /**
   * Cambia solo cuando el contador SUBE. La plantilla recrea el globo con este
   * valor, y así el "late" se reproduce al llegar una notificación nueva, pero
   * no al leer una (que también cambia el número).
   */
  pulsoContador = 0;

  private destroy$ = new Subject<void>();
  private sseSub?: Subscription;
  private sseTicketSub?: Subscription;

  constructor(
    public authService: AuthService,
    private router: Router,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private themeService: ThemeService,
private sseService: SseService,
      private toastService: ToastService,
      private globalSearchService: GlobalSearchService,
      public notificationSound: NotificationSoundService,
    ) {
    this.role = this.authService.getRole();
    this.email = this.authService.getEmail();
    this.isAdmin = this.role?.toUpperCase() === "ADMIN";
    this.isSuperAdmin = this.role?.toUpperCase() === "SUPER_ADMIN";
    this.loadLogo();
    this.themeService.theme
      .pipe(takeUntil(this.destroy$))
      .subscribe((t) => (this.isDark = t === "dark"));
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  /** Abre el buscador global (también disponible con Ctrl + K). */
  abrirBusqueda(): void {
    this.globalSearchService.open();
  }

  /**
   * Enciende o apaga el aviso sonoro de las notificaciones. Al encenderlo suena
   * una muestra, para que se sepa de inmediato que el navegador lo permite: sin
   * ella, activar el interruptor no daría ninguna señal y no se sabría si el
   * problema es la política de autoplay o que no hay sonido.
   */
  toggleSonido(): void {
    this.notificationSound.toggle();
    if (this.notificationSound.enabled) {
      this.notificationSound.preview();
    }
  }

  ngOnInit(): void {
    this.loadUser();
    this.loadNotifications();

    // Conexión SSE de toda la aplicación: mantiene vivos el chat y las
    // notificaciones sin depender de qué pantalla esté abierta.
    this.sseService.connect();

    // El punto de presencia refleja el estado real de la conexión. Al abrirse se
    // vuelve a pedir el perfil para que el resto de datos (incluido
    // sessionState en las tarjetas) no lleguen con el valor previo al SSE.
    this.sseService.status$
      .pipe(takeUntil(this.destroy$))
      .subscribe((estado) => {
        const antes = this.sseStatus;
        this.sseStatus = estado;
        if (estado === "connected" && antes !== "connected") {
          this.loadUser();
          this.loadNotifications();
        }
      });

    // Cuenta atrás de la sesión. El reloj vive en AuthService para que no se
    // reinicie al cambiar de pantalla.
    this.authService.sessionRemaining$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ms) => this.updateSesion(ms));

    // Cuenta atrás de inactividad, que es la que se muestra: baja sola mientras
    // el usuario no toca nada y se reinicia con la primera interacción.
    this.authService.idleRemaining$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ms) => this.updateInactividad(ms));

// Notificaciones nuevas en vivo: el backend avisa por SSE en cuanto se crea
      // una, sin esperar al sondeo de respaldo.
      //
      // Antes el manejador descartaba el evento y solo refrescaba la lista, así
      // que una notificación nueva solo se notaba por el número de la campana.
      // Ahora se usa el tipo que trae el evento para elegir el tono de aviso.
      this.sseSub = this.sseService.notification$.subscribe((evento) => {
        this.loadNotifications();
        // El sonido se engancha solo aquí, y no al evento de ticket ni al sondeo
        // de respaldo: una misma acción genera los dos, y sonaría dos veces.
        this.notificationSound.playFor(evento?.type ?? undefined);
        this.avisarEnPantalla(evento);
      });
      this.sseTicketSub = this.sseService.ticketEvent$.subscribe(() =>
        this.loadNotifications(),
      );

    // Cuando se marca algo como leido desde la pagina de notificaciones, esta
    // barra tiene que enterarse: antes solo se actualizaba al llegar un evento
    // por SSE o al pasar el sondeo, y el contador se quedaba congelado.
    this.notificationService
      .unreadChanged$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());

    // Refresca cada 60 segundos como respaldo
    interval(60_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadNotifications());
  }

  /**
   * Aviso emergente de la notificación que acaba de llegar. Antes solo cambiaba
   * el número de la campana y sonaba, y quien no miraba la campana no se
   * enteraba. Un mensaje del chat del ticket que se está viendo no se repite:
   * ese aviso ya lo da el propio chat.
   */
  private avisarEnPantalla(evento: { type?: string; subject?: string; ticketId?: string | null } | null): void {
    if (!evento?.subject) return;
    const enEseTicket = !!evento.ticketId && this.router.url.startsWith(`/tickets/${evento.ticketId}`);
    if (enEseTicket && evento.type === "CHAT_MENSAJE") return;
    const destino = notificationTarget({
      typeNotification: evento.type,
      ticketId: evento.ticketId ?? undefined,
    } as Parameters<typeof notificationTarget>[0]);
    this.toastService.info(evento.subject, "Nueva notificación", {
      duration: 7000,
      action: destino && !enEseTicket ? { label: "Ver", route: destino } : undefined,
    });
  }

  ngOnDestroy(): void {
    this.sseSub?.unsubscribe();
    this.sseTicketSub?.unsubscribe();
    this.sseService.close();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLogo(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => (this.logoUrl = b.logoUrl || ""),
      error: () => (this.logoUrl = ""),
    });
  }

  loadNotifications(): void {
    this.notificationService.myNotifications().subscribe({
      next: (list) => {
        const todas = list || [];
        this.notifications = todas.slice(0, 20);
        const sinLeer = todas.filter((n) => !n.readNotification).length;
        if (sinLeer > this.notificationsCount) this.pulsoContador++;
        this.notificationsCount = sinLeer;
      },
      error: () => {
        this.notifications = [];
        this.notificationsCount = 0;
      },
    });
  }

  /** Al abrir una notificación se marca como leída y se actualiza el contador. */
  abrirNotificacion(n: Notification): void {
    if (!n.readNotification) {
      this.notificationService.markAsRead(n.idNotification).subscribe(() => {
        n.readNotification = true;
        n.readAtNotification = new Date().toISOString();
        this.notificationsCount = Math.max(0, this.notificationsCount - 1);
      });
    }
    const destino = notificationTarget(n);
    if (destino) {
      this.cerrarDropdownNotificaciones();
      this.router.navigate(destino);
    }
  }

  /**
   * Cierra el desplegable de la campana.
   *
   * Es un dropdown de daisyUI que se abre con `:focus-within` sobre la etiqueta
   * de la campana. Al pulsar un item el foco se queda ahí, porque un `<a>` sin
   * `href` no es enfocable, así que el menú seguía abierto encima de la página a
   * la que acabábamos de navegar y parecía que el clic no había hecho nada.
   */
  private cerrarDropdownNotificaciones(): void {
    const activo = document.activeElement;
    if (activo instanceof HTMLElement) {
      activo.blur();
    }
  }

  loadUser(): void {
    this.authService.me().subscribe({
      next: (u) => {
        this.user = u;
      },
      error: () => {
        this.user = null;
      },
    });
  }

  get initials(): string {
    const u = this.user;
    if (u?.displayName) return u.displayName.charAt(0).toUpperCase();
    if (u?.firstName) return u.firstName.charAt(0).toUpperCase();
    if (u?.corporateEmailUser)
      return u.corporateEmailUser.charAt(0).toUpperCase();
    return this.email ? this.email.charAt(0).toUpperCase() : "U";
  }

  get displayName(): string {
    const u = this.user;
    if (!u) return this.email || "Usuario";
    if (u.displayName) return u.displayName;
    const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
    return full || u.corporateEmailUser || this.email;
  }

  /**
   * Estado de presencia para el punto de la barra superior.
   *
   * El backend solo puede marcar EN_LINEA cuando existe una conexión SSE abierta,
   * así que el valor guardado en `user.sessionState` se queda obsoleto: al
   * arrancar se pedía el perfil antes de abrir el SSE y por eso salia
   * "Conectado recientemente" aunque la sesión estuviera viva. Ahora manda el
   * estado real de la conexión y el perfil se vuelve a pedir cuando abre.
   */
  get sesionEstado(): SessionState {
    // Mientras la conexión se abre no se marca como desconectado: ver
    // estadoDesdeConexion en session-presence.util.
    return estadoDesdeConexion(this.sseStatus, this.user?.sessionState);
  }

  get sesionLabel(): string {
    return metaSesion(this.sesionEstado).label;
  }

  /** Clase del punto. Conectado va en blanco, como se pidió. */
  get sesionDot(): string {
    return SESION_PUNTO_NAVBAR[this.sesionEstado];
  }

  /** Pinta el tiempo restante y marca el aviso cuando entra en el margen. */
  private updateSesion(ms: number): void {
    if (ms <= 0) {
      this.sesionRestante = "";
      this.sesionPorVencer = false;
      return;
    }
    const total = Math.floor(ms / 1000);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    this.sesionRestante =
      horas > 0
        ? `${horas}h ${String(minutos).padStart(2, "0")}m`
        : `${minutos}:${String(segundos).padStart(2, "0")}`;

    this.sesionPorVencer = ms <= this.authService.warningMinutes() * 60_000;
  }

  /** Renueva el token a mano cuando el aviso automatico no alcanza. */
  renovarSesion(): void {
    if (this.sesionRenovando) return;
    this.sesionRenovando = true;
    this.authService.refreshSession().subscribe({
      next: () => {
        this.sesionRenovando = false;
        this.toastService.success("Sesión renovada");
      },
      error: () => (this.sesionRenovando = false),
    });
  }

  /** Pinta el tiempo sin actividad y avisa cuando ya va a cerrarse. */
  private updateInactividad(ms: number): void {
    if (ms <= 0) {
      this.inactividadRestante = "";
      this.inactividadPorVencer = false;
      return;
    }
    const total = Math.floor(ms / 1000);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    this.inactividadRestante =
      horas > 0
        ? `${horas}h ${String(minutos).padStart(2, "0")}m`
        : `${minutos}:${String(segundos).padStart(2, "0")}`;

    const total_ = this.authService.idleMinutos() * 60_000;
    this.inactividadPorVencer = ms <= total_ * this.AVISO_INACTIVIDAD;
  }

  /**
   * Cuando el aviso de inactividad aparece, un clic basta para reiniciar el
   * reloj. Se renueva el token solo si ya casi no queda, para no gastar un
   * refresh en cada toque.
   */
  seguirActivo(): void {
    if (this.authService.idleHabilitado()) {
      this.authService.reiniciarInactividad();
    }
    if (this.inactividadPorVencer && !this.inactividadRenovando) {
      this.inactividadRenovando = true;
      this.authService.refreshSession().subscribe({
        next: () => {
          this.inactividadRenovando = false;
          this.toastService.success("Sesión renovada");
        },
        error: () => (this.inactividadRenovando = false),
      });
    }
  }

  get roleLabel(): string {
    switch (this.role?.toUpperCase()) {
      case "SUPER_ADMIN":
        return "Super Administrador";
      case "ADMIN":
        return "Administrador";
      case "AGENT":
        return "Agente";
      case "USER":
        return "Usuario";
      default:
        return this.role || "";
    }
  }

  get photoSrc(): string | null {
    if (!this.user?.photoUrl) return null;
    if (/^https?:\/\//i.test(this.user.photoUrl)) return this.user.photoUrl;
    return `${environment.apiUrl}${this.user.photoUrl}`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(["/auth/login"]);
  }

  // El icono y el color de cada tipo viven en core/constants para que el
  // dropdown de la barra y la pagina de notificaciones se vean igual.
  notificationIcon = notificationIcon;
  getNotificationIconClass = notificationColor;

  /**
   * Agrupa las notificaciones del navbar por fecha.
   * Solo agrupa las que ya están en `this.notifications` (máx. 20).
   */
  gruposNavbar(): { label: string; items: Notification[] }[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - 7);

    const grupos: Record<string, Notification[]> = {
      Hoy: [],
      Ayer: [],
      "Esta semana": [],
      Anteriores: [],
    };

    (this.notifications || []).forEach((n) => {
      const fecha = new Date(n.createdAtNotification);
      fecha.setHours(0, 0, 0, 0);

      if (fecha.getTime() >= hoy.getTime()) {
        grupos["Hoy"].push(n);
      } else if (fecha.getTime() >= ayer.getTime()) {
        grupos["Ayer"].push(n);
      } else if (fecha.getTime() >= inicioSemana.getTime()) {
        grupos["Esta semana"].push(n);
      } else {
        grupos["Anteriores"].push(n);
      }
    });

    return Object.entries(grupos)
      .filter(([_, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }

  /**
   * Marca una notificación como leída sin salir del dropdown.
   * Se llama desde el botón ✓ que aparece al hover.
   */
  marcarComoLeida(event: Event, n: Notification): void {
    event.preventDefault();
    event.stopPropagation();

    if (n.readNotification) return;

    this.notificationService.markAsRead(n.idNotification).subscribe({
      next: () => {
        n.readNotification = true;
        n.readAtNotification = new Date().toISOString();
        this.notificationsCount = Math.max(0, this.notificationsCount - 1);
        this.notificationService.notificarLectura();
      },
      error: () => undefined,
    });
  }

  /**
   * Marca todas las notificaciones como leídas desde el dropdown.
   * Se llama desde el botón "Marcar todas" del header.
   */
  marcarTodasComoLeidas(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.notificationsCount === 0) return;

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        const ahora = new Date().toISOString();
        (this.notifications || []).forEach((n) => {
          if (!n.readNotification) {
            n.readNotification = true;
            n.readAtNotification = ahora;
          }
        });
        this.notificationsCount = 0;
        this.notificationService.notificarLectura();
        this.toastService.success("Notificaciones marcadas como leídas");
      },
      error: () => this.toastService.error("No se pudieron marcar como leídas"),
    });
  }

  // ============ Indicador unificado del navbar ============

  /**
   * Decide qué mostrar en el botón del navbar según la urgencia.
   * Prioridad: inactividad por vencer > sesión por vencer > inactividad normal > sesión normal.
   */
  get indicadorTiempo(): {
    texto: string;
    clase: string;
    icono: string;
    tooltip: string;
    progreso: number | null;
  } {
    const renovando = this.inactividadRenovando || this.sesionRenovando;

    if (renovando) {
      return {
        texto: "Renovando...",
        clase: "btn-ghost text-white/85 hover:bg-white/10",
        icono: "fa-solid fa-rotate",
        tooltip: "Renovando la sesión...",
        progreso: null,
      };
    }

    // Inactividad por vencer: es lo más urgente
    if (this.inactividadPorVencer && this.inactividadRestante) {
      return {
        texto: this.inactividadRestante,
        clase:
          "btn-warning text-warning-content hover:brightness-110 shadow-md",
        icono: "fa-solid fa-triangle-exclamation",
        tooltip: "La sesión se cierra por inactividad. Pulsa para continuar.",
        progreso: null,
      };
    }

    // Sesión por vencer (token)
    if (this.sesionPorVencer && this.sesionRestante) {
      return {
        texto: this.sesionRestante,
        clase: "btn-warning text-warning-content hover:brightness-110",
        icono: "fa-regular fa-clock",
        tooltip:
          "El token está por expirar. Se renovará al seguir usando el sistema.",
        progreso: null,
      };
    }

    // Inactividad normal
    if (this.inactividadRestante) {
      return {
        texto: this.inactividadRestante,
        clase: "btn-ghost text-white/85 hover:bg-white/10",
        icono: "fa-regular fa-clock",
        tooltip: "Tiempo sin actividad antes de que se cierre la sesión",
        progreso: null,
      };
    }

    // Sesión normal
    return {
      texto: this.sesionRestante || "",
      clase: "btn-ghost text-white/85 hover:bg-white/10",
      icono: "fa-regular fa-clock",
      tooltip: "Tiempo restante de la sesión",
      progreso: null,
    };
  }

  // ============ Progresos para las barras del dropdown ============

  /** Progreso de inactividad (1 = queda todo, 0 = se cerró). */
  get progresoInactividad(): number {
    const total = this.authService.idleMinutos() * 60_000;
    if (!total) return 0;
    const restante = this.msDesdeTexto(this.inactividadRestante);
    return Math.max(0, Math.min(100, (restante / total) * 100));
  }

  /** Progreso de sesión (1 = queda todo, 0 = expiró). */
  get progresoSesion(): number {
    const total = this.authService.warningMinutes() * 60_000 * 5; // aproximado
    if (!total) return 0;
    const restante = this.msDesdeTexto(this.sesionRestante);
    return Math.max(0, Math.min(100, (restante / total) * 100));
  }

  /**
   * Convierte el texto formateado ("1h 05m" o "14:32") a milisegundos.
   * Necesario porque guardamos el tiempo como string, no como número.
   */
  private msDesdeTexto(texto: string): number {
    if (!texto) return 0;

    // Formato "1h 05m"
    const matchHoras = texto.match(/^(\d+)h\s+(\d+)m$/);
    if (matchHoras) {
      return (Number(matchHoras[1]) * 3600 + Number(matchHoras[2]) * 60) * 1000;
    }

    // Formato "mm:ss"
    const matchMinutos = texto.match(/^(\d+):(\d+)$/);
    if (matchMinutos) {
      return (Number(matchMinutos[1]) * 60 + Number(matchMinutos[2])) * 1000;
    }

    return 0;
  }

  // ============ Círculo de progreso (SVG) ============
  get progresoCirculo(): { circunferencia: number; offset: number } {
    const r = 6;
    const circunferencia = 2 * Math.PI * r; // ≈ 37.7
    const porcentaje = this.progresoInactividad / 100;
    const offset = circunferencia * (1 - porcentaje);
    return { circunferencia, offset };
  }
}

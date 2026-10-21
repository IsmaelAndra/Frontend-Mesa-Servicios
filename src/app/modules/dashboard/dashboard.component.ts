import { TemaTemporadaService } from '../../core/services/tema-temporada.service';
import { TemaActual } from '../../models/tema-temporada.model';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChartData, ChartOptions } from 'chart.js';
import { DashboardService, EvaluationService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SseService } from '../../core/services/sse.service';
import { ThemeService } from '../../core/services/theme.service';
import { BrowserNotificationService } from '../../core/services/browser-notification.service';
import {
  AgentLoad,
  DashboardOperations,
  DashboardStats,
  MonthlyEvaluation,
  TicketAtencion,
  TicketEvent
} from '../../models/dashboard.model';
import { urlDelApi } from '../../core/utils/url-api.util';

/** Periodos rápidos del selector; null = el último año (lo que el backend usa por defecto). */
type Periodo = 7 | 30 | 90 | null | 'personalizado';

/** Cambio frente al periodo anterior, ya listo para pintar. */
interface Tendencia {
  texto: string;
  icono: string;
  clase: string;
  titulo: string;
}

/** Colores fijos por nombre: coinciden con los que siembra la base para estados y prioridades. */
const COLOR_ESTADO: Record<string, string> = {
  NUEVO: '#2563EB', ASIGNADO: '#7C3AED', EN_PROCESO: '#D97706', RESUELTO: '#059669',
  CERRADO: '#6B7280', REABIERTO: '#DC2626', ESCALADO: '#DB2777',
};
const COLOR_PRIORIDAD: Record<string, string> = {
  BAJA: '#059669', MEDIA: '#2563EB', ALTA: '#D97706', CRITICA: '#DC2626',
};
const PALETA = ['#062e86', '#ec9811', '#0d9488', '#7c3aed', '#db2777', '#2563eb', '#65a30d', '#ea580c'];

/**
 * Tablero principal.
 *
 * <p>Arriba lo que pide acción (SLA vencido, lo que vence antes); después los
 * indicadores del periodo con su tendencia frente al periodo anterior; y debajo
 * el detalle: flujo semanal, estado, antigüedad de lo pendiente, carga del
 * equipo y a qué horas llegan los tickets. Cada rol ve su alcance: el backend ya
 * devuelve los datos acotados.
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats!: DashboardStats;
  loading = true;

  from = '';
  to = '';
  periodo: Periodo = null;
  readonly periodos: { valor: Periodo; texto: string }[] = [
    { valor: 7, texto: '7 días' },
    { valor: 30, texto: '30 días' },
    { valor: 90, texto: '90 días' },
    { valor: null, texto: '12 meses' },
    { valor: 'personalizado', texto: 'Personalizado' },
  ];

  isAgent = false;
  rol = '';
  nombre = '';
  evaluations: MonthlyEvaluation[] = [];
  loadingEvaluation = false;

  canSeeOps = false;
  operations: DashboardOperations | null = null;
  sseEvents: TicketEvent[] = [];
  sseStatus: 'connecting' | 'connected' | 'closed' = 'closed';
  private myUserId: string | null = null;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly subscriptions: Subscription[] = [];
  private oscuro = false;

  // ---- Gráficos ----
  flujo: ChartData<'line'> = { labels: [], datasets: [] };
  estados: ChartData<'doughnut'> = { labels: [], datasets: [] };
  areas: ChartData<'bar'> = { labels: [], datasets: [] };
  categorias: ChartData<'bar'> = { labels: [], datasets: [] };

  flujoOptions: ChartOptions<'line'> = {};
  donaOptions: ChartOptions<'doughnut'> = {};
  barrasOptions: ChartOptions<'bar'> = {};

  readonly dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly horas = Array.from({ length: 24 }, (_, i) => i);

  /** Tema de temporada visible (saludo, imagen y adornos del encabezado), o null. */
  tema: TemaActual | null = null;
  /** Partículas del encabezado: pocas, es una pantalla que se mira todo el día. */
  readonly particulasHero = Array.from({ length: 8 }, (_, i) => i);
  /** Años de la cooperativa (fundada el 11 de noviembre de 1968). */
  readonly aniosCooperativa = new Date().getFullYear() - 1968;
  private readonly temaTemporada = inject(TemaTemporadaService);

  constructor(
    private dashboardService: DashboardService,
    private evaluationService: EvaluationService,
    private authService: AuthService,
    private toastService: ToastService,
    private sseService: SseService,
    private themeService: ThemeService,
    private browserNotif: BrowserNotificationService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(this.temaTemporada.temaVisible$.subscribe((t) => (this.tema = t)));
    this.rol = this.authService.getRole();
    this.isAgent = this.rol === 'AGENT';
    // Un agente solo ve su propia información: la operación en tiempo real es
    // una vista de supervisión y no le corresponde.
    this.canSeeOps = this.rol === 'ADMIN' || this.rol === 'SUPER_ADMIN';
    this.nombre = this.primerNombre(this.authService.currentUserSnapshot()?.displayName || '');

    // Los gráficos toman los colores del tema: en oscuro, rejilla y textos claros.
    this.subscriptions.push(this.themeService.theme.subscribe((t) => {
      this.oscuro = t === 'dark';
      this.prepararOpciones();
      if (this.stats) this.construirGraficos(this.stats);
    }));

    this.load();
    if (this.isAgent) {
      this.loadEvaluation();
    }
    this.authService.me().subscribe({
      next: (u) => {
        this.myUserId = u.idUser;
        if (!this.nombre) this.nombre = this.primerNombre(u.displayName || u.corporateEmailUser || '');
      },
      error: () => undefined,
    });
    if (this.canSeeOps) {
      this.loadOperations();
      this.subscriptions.push(this.sseService.status$.subscribe((s) => (this.sseStatus = s)));
      // La conexión la abre el navbar para toda la app; aquí solo se escuchan los eventos.
      this.subscriptions.push(
        this.sseService.ticketEvent$.subscribe((e: TicketEvent) => this.onSseEvent(e))
      );
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  // ============================ Encabezado ============================

  get saludo(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get fechaHoy(): string {
    const f = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
    return f.charAt(0).toUpperCase() + f.slice(1);
  }

  /** Qué abarca el tablero según el rol, para que nadie compare cifras de alcances distintos. */
  get alcance(): string {
    switch (this.rol) {
      case 'USER':
      case 'AREA_MANAGER': return 'Tus tickets';
      case 'AGENT': return 'Tickets asignados a ti';
      default: return 'Toda la mesa de servicios';
    }
  }

  private primerNombre(nombre: string): string {
    const limpio = nombre.includes('@') ? nombre.split('@')[0].split(/[._]/)[0] : nombre.trim().split(/\s+/)[0];
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase() : '';
  }

  // ============================ Periodo ============================

  seleccionarPeriodo(p: Periodo): void {
    this.periodo = p;
    if (p === 'personalizado') return;
    if (p === null) {
      this.from = '';
      this.to = '';
    } else {
      const hasta = new Date();
      const desde = new Date();
      desde.setDate(hasta.getDate() - (p - 1));
      this.from = this.isoLocal(desde);
      this.to = this.isoLocal(hasta);
    }
    this.load();
  }

  applyFilters(): void {
    this.load();
  }

  clearFilters(): void {
    this.seleccionarPeriodo(null);
  }

  /** Texto del periodo para comparar ("frente a los 30 días anteriores"). */
  get textoPeriodoAnterior(): string {
    if (typeof this.periodo === 'number') return `los ${this.periodo} días anteriores`;
    if (this.periodo === null) return 'los 12 meses anteriores';
    return 'el periodo anterior';
  }

  private isoLocal(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ============================ Carga ============================

  loadOperations(): void {
    this.dashboardService.operations().subscribe({
      next: (o) => {
        this.operations = o;
        this.sseEvents = o.recentActivity.slice(-20).reverse();
      },
      error: () => { /* el panel operativo se queda vacío */ }
    });
  }

  private refreshAll(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.load(true);
      this.loadOperations();
    }, 250);
  }

  onSseEvent(e: TicketEvent): void {
    this.sseEvents = [e, ...this.sseEvents.filter((x) => x.seq !== e.seq)].slice(0, 20);
    this.refreshAll();
    if (this.myUserId && e.assignedAgentId === this.myUserId) {
      if (e.type === 'TICKET_ASSIGNED') {
        this.browserNotif.show('Ticket asignado', `${e.ticketTitle} · #${e.ticketNumber ?? ''}`, e.ticketId);
      } else if (e.type === 'TICKET_STATUS_CHANGED') {
        this.browserNotif.show(`Ticket #${e.ticketNumber ?? ""} · ${e.status || ''}`, e.ticketTitle, e.ticketId);
      }
    }
  }

  enableNotifications(): void {
    this.browserNotif.requestPermission().then((ok) => {
      if (ok) {
        this.browserNotif.show('Notificaciones activadas', 'Recibirás alertas de tus tickets en tiempo real');
      } else {
        this.toastService.warn('Permiso de notificaciones no concedido');
      }
    });
  }

  get notifSupported(): boolean {
    return this.browserNotif.supported();
  }

  get notifGranted(): boolean {
    return this.browserNotif.permissionGranted();
  }

  sseConnected(): boolean {
    return this.sseStatus === 'connected';
  }

  eventColor(type: string): string {
    switch (type) {
      case 'TICKET_CREATED': return '#10B981';
      case 'TICKET_ASSIGNED': return '#3B82F6';
      case 'TICKET_STATUS_CHANGED': return '#F59E0B';
      case 'TICKET_ANSWERED': return '#8B5CF6';
      case 'TICKET_ATTACHMENT': return '#EC4899';
      default: return '#6B7280';
    }
  }

  eventIcon(type: string): string {
    switch (type) {
      case 'TICKET_CREATED': return 'fa-solid fa-plus';
      case 'TICKET_ASSIGNED': return 'fa-solid fa-user-check';
      case 'TICKET_STATUS_CHANGED': return 'fa-solid fa-arrows-rotate';
      case 'TICKET_ANSWERED': return 'fa-solid fa-comment';
      case 'TICKET_ATTACHMENT': return 'fa-solid fa-paperclip';
      default: return 'fa-solid fa-bolt';
    }
  }

  trackEvento(_: number, ev: TicketEvent): number {
    return ev.seq;
  }

  eventLabel(ev: TicketEvent): string {
    switch (ev.type) {
      case 'TICKET_CREATED': return 'creado';
      case 'TICKET_ASSIGNED': return ev.assignedAgentName ? `asignado a ${ev.assignedAgentName}` : 'asignado';
      case 'TICKET_STATUS_CHANGED': return `estado → ${ev.status || ''}`;
      case 'TICKET_ANSWERED': return 'nueva respuesta';
      case 'TICKET_ATTACHMENT': return 'archivo adjunto';
      default: return ev.type;
    }
  }

  /**
   * @param silencioso al refrescar por un evento en vivo no se enseña el
   *                   esqueleto: los datos se sustituyen en su sitio.
   */
  load(silencioso = false): void {
    if (!silencioso) this.loading = true;
    this.dashboardService.stats(undefined, undefined, undefined, this.from || undefined, this.to || undefined).subscribe({
      next: (s) => {
        this.stats = s;
        this.construirGraficos(s);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'No se pudieron cargar las estadísticas');
      }
    });
  }

  private loadEvaluation(): void {
    this.loadingEvaluation = true;
    this.evaluationService.mine().subscribe({
      next: (e) => {
        this.evaluations = e;
        this.loadingEvaluation = false;
      },
      error: () => {
        this.loadingEvaluation = false;
      }
    });
  }

  get latestEvaluation(): MonthlyEvaluation | null {
    return this.evaluations.length ? this.evaluations[0] : null;
  }

  // ============================ Indicadores ============================

  /**
   * Cambio frente al periodo anterior.
   * @param menosEsMejor true en lo que conviene que baje (horas de resolución).
   * @param enPuntos true para porcentajes: la diferencia va en puntos, no en %.
   */
  tendencia(actual: number | null | undefined, previo: number | null | undefined,
            menosEsMejor = false, enPuntos = false): Tendencia | null {
    if (actual == null || previo == null) return null;
    if (!enPuntos && previo === 0) return null;
    const diff = enPuntos ? actual - previo : ((actual - previo) / previo) * 100;
    const redondeo = Math.round(diff * 10) / 10;
    if (Math.abs(redondeo) < 0.5) {
      return { texto: 'igual', icono: 'fa-solid fa-minus', clase: 'tendencia--neutra', titulo: `Sin cambios frente a ${this.textoPeriodoAnterior}` };
    }
    const sube = redondeo > 0;
    const bueno = menosEsMejor ? !sube : sube;
    const valor = `${sube ? '+' : ''}${redondeo.toLocaleString('es-EC', { maximumFractionDigits: 1 })}${enPuntos ? ' pts' : '%'}`;
    return {
      texto: valor,
      icono: sube ? 'fa-solid fa-arrow-trend-up' : 'fa-solid fa-arrow-trend-down',
      clase: bueno ? 'tendencia--buena' : 'tendencia--mala',
      titulo: `${valor} frente a ${this.textoPeriodoAnterior}`,
    };
  }

  /** Puntos y área de una minigráfica SVG de 100 x 28. */
  sparkline(valores: number[] | undefined): { linea: string; area: string } | null {
    if (!valores || valores.length < 2) return null;
    const max = Math.max(...valores, 1);
    const paso = 100 / (valores.length - 1);
    const pts = valores.map((v, i) => `${(i * paso).toFixed(1)},${(26 - (v / max) * 24).toFixed(1)}`);
    return { linea: pts.join(' '), area: `0,28 ${pts.join(' ')} 100,28` };
  }

  /** Anillo del SLA: el ángulo del conic-gradient. */
  anguloSla(v: number | null | undefined): string {
    return `${Math.max(0, Math.min(100, v ?? 0)) * 3.6}deg`;
  }

  claseSla(v: number | null | undefined): string {
    if (v == null) return 'anillo--neutro';
    return v >= 90 ? 'anillo--bueno' : v >= 75 ? 'anillo--medio' : 'anillo--malo';
  }

  /** Estrellas de la satisfacción: llenas, media y vacías. */
  estrellas(v: number | null | undefined): ('llena' | 'media' | 'vacia')[] {
    const n = v ?? 0;
    return [1, 2, 3, 4, 5].map((i) => (n >= i ? 'llena' : n >= i - 0.5 ? 'media' : 'vacia'));
  }

  get tasaResolucion(): number | null {
    if (!this.stats?.totalTickets) return null;
    return Math.round((this.stats.resolvedTickets / this.stats.totalTickets) * 100);
  }

  // ============================ Atención ============================

  plazo(a: TicketAtencion): string {
    const diff = new Date(a.dueAt).getTime() - Date.now();
    const min = Math.round(Math.abs(diff) / 60_000);
    const t = min < 60 ? `${min} min` : min < 60 * 48 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} días`;
    return diff < 0 ? `venció hace ${t}` : `vence en ${t}`;
  }

  colorPrioridad(p: string): string {
    return COLOR_PRIORIDAD[(p || '').toUpperCase()] ?? '#64748b';
  }

  // ============================ Antigüedad y prioridad ============================

  /*
   * Las listas que pinta la plantilla se calculan UNA vez al llegar los datos.
   * Como getters devolvían un array nuevo en cada detección de cambios: Angular
   * recreaba las barras sin parar y su animación de crecer volvía a empezar de
   * cero, así que se veían vacías.
   */
  tramosAntiguedad: { tramo: string; valor: number; pct: number; color: string }[] = [];
  totalPendiente = 0;
  prioridades: { nombre: string; valor: number; pct: number; color: string }[] = [];
  leyendaEstados: { nombre: string; valor: number; color: string; pct: number }[] = [];

  private calcularTramos(): { tramo: string; valor: number; pct: number; color: string }[] {
    const a = this.stats?.backlogAging;
    if (!a) return [];
    const colores = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];
    const total = Object.values(a).reduce((s, v) => s + v, 0);
    return Object.entries(a).map(([tramo, valor], i) => ({
      tramo, valor, pct: total ? (valor / total) * 100 : 0, color: colores[i] ?? '#64748b',
    }));
  }

  private calcularPrioridades(): { nombre: string; valor: number; pct: number; color: string }[] {
    const p = this.stats?.ticketsByPriority;
    if (!p) return [];
    const orden = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];
    const total = Object.values(p).reduce((s, v) => s + v, 0);
    return Object.entries(p)
      .sort(([a], [b]) => (orden.indexOf(a) + 99 * +(orden.indexOf(a) < 0)) - (orden.indexOf(b) + 99 * +(orden.indexOf(b) < 0)))
      .map(([nombre, valor]) => ({ nombre, valor, pct: total ? (valor / total) * 100 : 0, color: this.colorPrioridad(nombre) }));
  }

  // ============================ Equipo ============================

  get maxCarga(): number {
    return Math.max(1, ...(this.stats?.agentLoad ?? []).map((a) => a.openTickets + a.resolvedTickets));
  }

  fotoAgente(a: AgentLoad): string | null {
    if (!a.photoUrl) return null;
    return urlDelApi(a.photoUrl);
  }

  iniciales(nombre: string): string {
    const partes = (nombre || '?').replace(/@.*/, '').split(/[\s._]+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
  }

  // ============================ Mapa de calor ============================

  get maxCalor(): number {
    return Math.max(1, ...(this.stats?.activityHeatmap ?? []).flat());
  }

  /** Intensidad 0-4 de una celda, para la escala de color. */
  nivelCalor(v: number): number {
    if (!v) return 0;
    return Math.min(4, Math.ceil((v / this.maxCalor) * 4));
  }

  /** La franja con más llegadas, en palabras ("los martes entre 9:00 y 10:00"). */
  get horaPico(): string | null {
    const m = this.stats?.activityHeatmap;
    if (!m) return null;
    let mejor = { d: -1, h: -1, v: 0 };
    m.forEach((fila, d) => fila.forEach((v, h) => { if (v > mejor.v) mejor = { d, h, v }; }));
    if (mejor.v === 0) return null;
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
    return `los ${dias[mejor.d]} entre ${mejor.h}:00 y ${mejor.h + 1}:00`;
  }

  // ============================ Gráficos ============================

  private prepararOpciones(): void {
    const texto = this.oscuro ? '#cbd5e1' : '#475569';
    const rejilla = this.oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tooltip = {
      backgroundColor: this.oscuro ? '#0f172a' : '#1e293b',
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: 'bold' as const },
      boxPadding: 4,
    };
    this.flujoOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, color: texto, font: { size: 11 } } },
        tooltip,
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: texto, font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { precision: 0, color: texto, font: { size: 10 } }, grid: { color: rejilla } },
      },
      elements: { point: { radius: 0, hoverRadius: 5 }, line: { tension: 0.35, borderWidth: 2.5 } },
    };
    this.donaOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false }, tooltip },
    };
    this.barrasOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, color: texto, font: { size: 10 } }, grid: { color: rejilla } },
        y: { grid: { display: false }, ticks: { color: texto, font: { size: 11 } } },
      },
    };
  }

  /** Etiquetas de la leyenda del estado, con su color y cifra. */
  private calcularLeyendaEstados(): { nombre: string; valor: number; color: string; pct: number }[] {
    const e = this.stats?.ticketsByStatus ?? {};
    const total = Object.values(e).reduce((s, v) => s + v, 0);
    return Object.entries(e)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, valor], i) => ({
        nombre: nombre.replace(/_/g, ' ').toLowerCase(),
        valor,
        color: COLOR_ESTADO[nombre] ?? PALETA[i % PALETA.length],
        pct: total ? Math.round((valor / total) * 100) : 0,
      }));
  }

  private construirGraficos(s: DashboardStats): void {
    if (!this.flujoOptions.plugins) this.prepararOpciones();
    this.tramosAntiguedad = this.calcularTramos();
    this.totalPendiente = this.tramosAntiguedad.reduce((t, x) => t + x.valor, 0);
    this.prioridades = this.calcularPrioridades();
    this.leyendaEstados = this.calcularLeyendaEstados();
    const etiquetas = s.weekLabels?.length ? s.weekLabels : s.ticketsLast12Weeks.map((_, i) => `S-${12 - i}`);

    this.flujo = {
      labels: etiquetas,
      datasets: [
        {
          label: 'Creados',
          data: s.ticketsLast12Weeks,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.12)',
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#2563eb',
          fill: true,
        },
        ...(s.resolvedLast12Weeks ? [{
          label: 'Resueltos',
          data: s.resolvedLast12Weeks,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#10b981',
          fill: true,
        }] : []),
      ],
    };

    const estados = Object.entries(s.ticketsByStatus).sort(([, a], [, b]) => b - a);
    this.estados = {
      labels: estados.map(([k]) => k.replace(/_/g, ' ')),
      datasets: [{
        data: estados.map(([, v]) => v),
        backgroundColor: estados.map(([k], i) => COLOR_ESTADO[k] ?? PALETA[i % PALETA.length]),
        borderWidth: 3,
        borderColor: this.oscuro ? '#1f2937' : '#ffffff',
        hoverOffset: 6,
      }],
    };

    this.areas = this.barras(s.ticketsByArea, '#062e86');
    this.categorias = this.barras(s.ticketsByCategory, '#0d9488');
  }

  /** Barras horizontales ordenadas de mayor a menor, con las ocho primeras. */
  private barras(datos: Record<string, number>, color: string): ChartData<'bar'> {
    const orden = Object.entries(datos).sort(([, a], [, b]) => b - a).slice(0, 8);
    return {
      labels: orden.map(([k]) => k),
      datasets: [{
        data: orden.map(([, v]) => v),
        backgroundColor: color,
        hoverBackgroundColor: '#ec9811',
        borderRadius: 6,
        barThickness: 14,
      }],
    };
  }

  /** Alto de un gráfico de barras horizontales según cuántas filas tiene. */
  altoBarras(datos: ChartData<'bar'>): number {
    return Math.max(160, (datos.labels?.length ?? 0) * 30 + 40);
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { MailOutboxService } from '../../../core/services/mail-outbox.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { CorreoEnCola, EstadoCorreo, ResumenColaCorreo } from '../../../models/mail-outbox.model';

interface EstadoMeta {
  etiqueta: string;
  icono: string;
  clase: string;
  /** Color del badge (fondo tenue, borde y texto), como los badges de estado del resto de tablas. */
  color: string;
}

/** Presentación de cada estado: mismo patrón icono + color que el resto de badges. */
export const ESTADOS_CORREO: Record<EstadoCorreo, EstadoMeta> = {
  PENDIENTE: { etiqueta: 'Pendiente', icono: 'fa-solid fa-hourglass-half', clase: 'badge-warning text-warning-content', color: '#D97706' },
  ENVIANDO: { etiqueta: 'Enviando', icono: 'fa-solid fa-paper-plane', clase: 'badge-info text-info-content', color: '#2563EB' },
  ENVIADO: { etiqueta: 'Enviado', icono: 'fa-solid fa-check', clase: 'badge-success text-success-content', color: '#16A34A' },
  AGRUPADO: { etiqueta: 'En resumen', icono: 'fa-solid fa-layer-group', clase: 'badge-secondary text-secondary-content', color: '#7C3AED' },
  FALLIDO: { etiqueta: 'Fallido', icono: 'fa-solid fa-triangle-exclamation', clase: 'badge-error text-error-content', color: '#DC2626' },
  CANCELADO: { etiqueta: 'Cancelado', icono: 'fa-solid fa-ban', clase: 'badge-ghost', color: '#64748B' },
};

/** Etiquetas legibles de los tipos de aviso. */
const TIPOS: Record<string, string> = {
  TICKET_CREADO: 'Ticket creado',
  TICKET_ASIGNADO: 'Ticket asignado',
  TICKET_ACTUALIZADO: 'Ticket actualizado',
  TICKET_RESUELTO: 'Ticket resuelto',
  TICKET_CERRADO: 'Ticket cerrado',
  RATING_REQUEST: 'Pedir calificación',
  SLA_WARNING: 'SLA por vencer',
  SLA_BREACHED: 'SLA vencido',
  ESCALATION: 'Escalación',
  MONTHLY_EVALUATION: 'Evaluación mensual',
  TASK_ASIGNADA: 'Tarea asignada',
  CHAT_MENSAJE: 'Mensaje en el chat',
  CREACION_USUARIO: 'Cuenta nueva',
  RESET_PASSWORD: 'Restablecer contraseña',
  WORKFLOW: 'Automatización',
  SISTEMA: 'Sistema',
  OTRO: 'Otro',
};

/** Cada cuánto se refresca el panel solo. */
const REFRESCO_MS = 10_000;

@Component({
  selector: 'app-mail-outbox',
  templateUrl: './mail-outbox.component.html',
  styleUrls: ['./mail-outbox.component.css'],
})
export class MailOutboxComponent implements OnInit, OnDestroy {
  readonly estadosMeta = ESTADOS_CORREO;
  // ENVIANDO es un estado de segundos (el correo ya está reclamado por el envío):
  // como filtro solo confundía, porque "Enviando" y "Enviado" se leían igual.
  readonly filtros: ('' | EstadoCorreo)[] = ['', 'PENDIENTE', 'ENVIADO', 'AGRUPADO', 'FALLIDO', 'CANCELADO'];

  resumen: ResumenColaCorreo | null = null;
  correos: CorreoEnCola[] = [];
  total = 0;
  pagina = 0;
  tamano = 10;
  estado: '' | EstadoCorreo = '';
  busqueda = '';
  cargando = true;
  cargandoLista = false;
  autoRefresco = true;
  ultimaActualizacion: Date | null = null;

  horas: ChartData<'bar'> = { labels: [], datasets: [] };
  horasOptions: ChartOptions<'bar'> = {};
  tipos: ChartData<'doughnut'> = { labels: [], datasets: [] };
  tiposOptions: ChartOptions<'doughnut'> = {};

  private oscuro = false;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private busquedaTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Subscription();

  constructor(
    private service: MailOutboxService,
    private themeService: ThemeService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.themeService.theme.subscribe((t) => {
        this.oscuro = t === 'dark';
        this.armarGraficas();
      }),
    );
    this.refrescar();
    this.temporizador = setInterval(() => {
      // Solo con la pestaña visible: no tiene sentido consultar si nadie mira.
      if (this.autoRefresco && !document.hidden) this.refrescar(true);
    }, REFRESCO_MS);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.temporizador) clearInterval(this.temporizador);
    if (this.busquedaTimer) clearTimeout(this.busquedaTimer);
  }

  refrescar(silencioso = false): void {
    this.service.resumen().subscribe({
      next: (r) => {
        this.resumen = r;
        this.cargando = false;
        this.ultimaActualizacion = new Date();
        this.armarGraficas();
      },
      error: () => {
        this.cargando = false;
        if (!silencioso) this.toast.error('No se pudo cargar el estado de la cola de correo');
      },
    });
    this.cargarLista(silencioso);
  }

  cargarLista(silencioso = false): void {
    if (!silencioso) this.cargandoLista = true;
    this.service.listar(this.estado, this.busqueda, this.pagina, this.tamano).subscribe({
      next: (p) => {
        this.correos = p.content;
        this.total = p.totalElements;
        this.cargandoLista = false;
      },
      error: () => {
        this.cargandoLista = false;
        if (!silencioso) this.toast.error('No se pudieron cargar los correos');
      },
    });
  }

  cambiarEstado(e: '' | EstadoCorreo): void {
    this.estado = e;
    this.pagina = 0;
    this.cargarLista();
  }

  buscar(texto: string): void {
    this.busqueda = texto;
    if (this.busquedaTimer) clearTimeout(this.busquedaTimer);
    this.busquedaTimer = setTimeout(() => {
      this.pagina = 0;
      this.cargarLista();
    }, 300);
  }

  cambiarPagina(p: number): void {
    this.pagina = p;
    this.cargarLista();
  }

  cambiarTamano(t: number): void {
    this.tamano = t;
    this.pagina = 0;
    this.cargarLista();
  }

  reintentar(c: CorreoEnCola): void {
    this.service.reintentar(c.id).subscribe({
      next: () => {
        this.toast.success('Correo devuelto a la cola');
        this.refrescar(true);
      },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo reintentar'),
    });
  }

  cancelar(c: CorreoEnCola): void {
    void Swal.fire({
      title: '¿Cancelar este correo?',
      text: `No se enviará a ${c.to}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancelar el correo',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
      focusCancel: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.service.cancelar(c.id).subscribe({
        next: () => {
          this.toast.info('Correo cancelado');
          this.refrescar(true);
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo cancelar'),
      });
    });
  }

  reintentarFallidos(): void {
    const n = this.resumen?.fallidos ?? 0;
    void Swal.fire({
      title: `¿Reintentar ${n} ${n === 1 ? 'correo fallido' : 'correos fallidos'}?`,
      text: 'Vuelven a la cola y salen al ritmo normal.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reintentar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#062e86',
      reverseButtons: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.service.reintentarFallidos().subscribe({
        next: (x) => {
          this.toast.success(`${x.reencolados} correos devueltos a la cola`);
          this.refrescar(true);
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudieron reintentar'),
      });
    });
  }

  // ---------------- Presentación
  /** Reintentar (fallido o cancelado) o cancelar (pendiente o fallido). */
  tieneAcciones(c: { status: string }): boolean {
    return ['PENDIENTE', 'FALLIDO', 'CANCELADO'].includes(c.status);
  }

  /**
   * La columna Acciones solo aparece si algún correo de la página admite una.
   * Con todo enviado o agrupado quedaba una columna vacía sin nada que pulsar.
   */
  get hayAcciones(): boolean {
    return this.correos.some((c) => this.tieneAcciones(c));
  }

  get estadoEnvio(): { texto: string; detalle: string; clase: string; icono: string } {
    const r = this.resumen;
    if (!r) return { texto: 'Cargando…', detalle: '', clase: 'cc-estado--neutro', icono: 'fa-solid fa-circle-notch fa-spin' };
    if (!r.envioHabilitado) {
      return {
        texto: 'Envío deshabilitado',
        detalle: 'Actívalo en Microsoft Graph y Correo',
        clase: 'cc-estado--apagado',
        icono: 'fa-solid fa-power-off',
      };
    }
    if (r.pausadoHasta) {
      const h = new Date(r.pausadoHasta);
      return {
        texto: 'En pausa',
        detalle: `Microsoft pidió esperar hasta las ${h.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        clase: 'cc-estado--pausa',
        icono: 'fa-solid fa-circle-pause',
      };
    }
    return {
      texto: r.pendientes ? 'Enviando' : 'Al día',
      detalle: r.remitente ? `Desde ${r.remitente}` : '',
      clase: 'cc-estado--ok',
      icono: r.pendientes ? 'fa-solid fa-paper-plane' : 'fa-solid fa-circle-check',
    };
  }

  /** Porcentaje del límite por minuto que se está usando. */
  get usoRitmo(): number {
    const r = this.resumen;
    if (!r || !r.limitePorMinuto) return 0;
    return Math.min(100, Math.round((r.enviadosUltimoMinuto / r.limitePorMinuto) * 100));
  }

  antiguedad(segundos: number | null): string {
    if (segundos === null || segundos === undefined) return 'Sin pendientes';
    if (segundos < 60) return `el más antiguo, hace ${segundos} s`;
    const min = Math.round(segundos / 60);
    if (min < 60) return `el más antiguo, hace ${min} min`;
    return `el más antiguo, hace ${Math.round(min / 60)} h`;
  }

  tiempoVaciar(min: number): string {
    if (!min) return 'Al día';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${min % 60} min`;
  }

  tipo(t: string | null): string {
    return t ? TIPOS[t] ?? t : '—';
  }

  trackCorreo(_: number, c: CorreoEnCola): string {
    return c.id;
  }

  private armarGraficas(): void {
    const r = this.resumen;
    const texto = this.oscuro ? 'rgba(226,232,240,0.75)' : 'rgba(30,41,59,0.7)';
    const rejilla = this.oscuro ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tooltip = {
      backgroundColor: this.oscuro ? '#0f172a' : '#1e293b',
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: 'bold' as const },
      boxPadding: 4,
    };

    const puntos = r?.porHora ?? [];
    this.horas = {
      labels: puntos.map((p) => new Date(p.hora).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })),
      datasets: [
        { label: 'Enviados', data: puntos.map((p) => p.enviados), backgroundColor: '#16a34a', borderRadius: 4, stack: 'c' },
        { label: 'En resumen', data: puntos.map((p) => p.agrupados), backgroundColor: '#6366f1', borderRadius: 4, stack: 'c' },
        { label: 'Pendientes', data: puntos.map((p) => p.pendientes), backgroundColor: '#f59e0b', borderRadius: 4, stack: 'c' },
        { label: 'Fallidos', data: puntos.map((p) => p.fallidos), backgroundColor: '#dc2626', borderRadius: 4, stack: 'c' },
      ],
    };
    this.horasOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8, color: texto, font: { size: 11 } } },
        tooltip,
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: texto, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: texto, font: { size: 10 } }, grid: { color: rejilla } },
      },
    };

    const tipos = r?.porTipo ?? [];
    const paleta = ['#062e86', '#2563eb', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#64748b'];
    this.tipos = {
      labels: tipos.map((t) => this.tipo(t.tipo)),
      datasets: [{ data: tipos.map((t) => t.total), backgroundColor: paleta, borderWidth: 0, hoverOffset: 6 }],
    };
    this.tiposOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { duration: 300 },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: texto, font: { size: 11 }, padding: 12 } },
        tooltip,
      },
    };
  }
}

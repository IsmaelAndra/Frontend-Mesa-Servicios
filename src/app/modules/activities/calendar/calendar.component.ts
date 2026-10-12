import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  HostListener,
  NgZone
} from '@angular/core';
import Calendar, { EventObject } from '@toast-ui/calendar';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CalendarEvent } from '../../../models/task.model';
import { ResolvedTheme, ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CalendarStateService,
  CalendarView,
  etiquetaRango
} from '../../../core/services/calendar-state.service';

type CalendarTheme = Parameters<Calendar['setTheme']>[0];

/** Cómo de cerca está el vencimiento de un evento abierto. */
export type Urgencia = 'VENCIDO' | 'PROXIMO' | null;

/** Estados en los que un ticket o una tarea ya no pueden vencer. */
const ESTADOS_CERRADOS = new Set([
  'CERRADO', 'RESUELTO', 'COMPLETADA', 'COMPLETADO', 'FINALIZADA', 'FINALIZADO',
  'CANCELADA', 'CANCELADO', 'HECHA', 'HECHO', 'DONE'
]);

/** Ventana en la que un vencimiento se considera "por vencer". */
const MARGEN_PROXIMO_MS = 24 * 60 * 60 * 1000;

/**
 * Urgencia de un evento según su fin (el vencimiento del SLA en los tickets, la
 * fecha límite en las tareas). Lo cerrado nunca está vencido.
 */
export function urgenciaDe(e: CalendarEvent, ahora = Date.now()): Urgencia {
  if (ESTADOS_CERRADOS.has((e.status || '').toUpperCase())) return null;
  const fin = new Date(e.end).getTime();
  if (!Number.isFinite(fin)) return null;
  if (fin < ahora) return 'VENCIDO';
  if (fin - ahora <= MARGEN_PROXIMO_MS) return 'PROXIMO';
  return null;
}

/** Escapa texto para las plantillas de ToastUI, que se pintan como HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Contenido de un evento en la rejilla. Sustituye a la plantilla por defecto
 * para añadir el punto de urgencia; el título viene de los usuarios, así que se
 * escapa (las plantillas de ToastUI se insertan como HTML).
 */
export function plantillaEvento(ev: EventObject, conHora: boolean): string {
  const urgencia = (ev.raw as { urgencia?: Urgencia } | undefined)?.urgencia ?? null;
  const punto = urgencia === 'VENCIDO'
    ? '<span class="cal-punto cal-punto--vencido" aria-hidden="true"></span>'
    : urgencia === 'PROXIMO'
      ? '<span class="cal-punto cal-punto--proximo" aria-hidden="true"></span>'
      : '';
  const inicio = ev.start ? new Date(ev.start as unknown as string | Date) : null;
  const hora = conHora && inicio && !Number.isNaN(inicio.getTime())
    ? `<span class="cal-hora">${pad(inicio.getHours())}:${pad(inicio.getMinutes())}</span> `
    : '';
  return `${punto}${hora}${escaparHtml(String(ev.title ?? ''))}`;
}


@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('calendarEl') calendarEl!: ElementRef<HTMLDivElement>;

  /** Vista actual del calendario */
  currentView: CalendarView = 'week';

  rangeLabel = '';

  private calendar?: Calendar;

  isDark = false;

  private themeSub?: Subscription;

  /** Tema resuelto vigente. El null inicial marca que aún no llegó la primera emisión. */
  private currentTheme: ResolvedTheme | null = null;

  /** Evita que el setTimeout de init construya el calendario sobre un nodo ya desmontado. */
  private destroyed = false;

  /** Evento abierto en el panel lateral. */
  seleccionado: CalendarEvent | null = null;

  /** Ya se cargó el rango al menos una vez (para no mostrar "sin eventos" antes de tiempo). */
  cargado = false;

  /** Resumen de hoy, independiente del rango que se esté viendo. */
  hoy: { total: number; vencidos: number; proximos: number } | null = null;

  private readonly reducido =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  constructor(
    private http: HttpClient,
    private themeService: ThemeService,
    private toastService: ToastService,
    private calendarState: CalendarStateService,
    private zone: NgZone
  ) { }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.seleccionado) this.cerrarDetalle();
  }

  ngAfterViewInit(): void {
    // El tema se toma antes de construir el calendario. ToastUI congela su estado
    // interno con immer, así que setTheme() sobre una instancia viva intenta
    // asignar sobre objetos congelados y lanza "Cannot assign to read only
    // property 'backgroundColor'". Por eso el tema entra en el constructor y,
    // si cambia, se reconstruye la instancia en vez de repintarla.
    this.themeSub = this.themeService.theme.subscribe((theme) => {
      const cambio = this.currentTheme !== null && this.currentTheme !== theme;
      this.currentTheme = theme;
      this.isDark = theme === 'dark';
      if (cambio) {
        this.rebuildCalendar();
      }
    });

    // Se difiere un turno para que el contenedor ya tenga el tamaño final;
    // si el usuario navega antes, el guard evita dejar un calendario huérfano.
    setTimeout(() => {
      if (!this.destroyed) {
        this.initCalendar();
      }
    });
    // Red de seguridad: si la pestaña se cierra o se recarga, la fecha también queda.
    window.addEventListener('beforeunload', this.persistState);
  }

  /** Reconstruye el calendario conservando la fecha que se está viendo. */
  private rebuildCalendar(): void {
    if (this.destroyed || !this.calendar) {
      return;
    }
    this.initCalendar(this.calendar.getDate().toDate());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    // La instancia se destruye al navegar, así que la fecha se guarda aquí: es el
    // único punto donde se captura aunque el usuario no haya pulsado ningún botón.
    this.persistState();
    window.removeEventListener('beforeunload', this.persistState);
    this.themeSub?.unsubscribe();
    this.themeSub = undefined;
    this.destroyCalendar();
  }

  /** Elimina la instancia y el DOM que ToastUI dejó dentro del contenedor. */
  private destroyCalendar(): void {
    if (this.calendar) {
      try {
        this.calendar.destroy();
      } catch {
        // Si la instancia ya estaba liberada, seguimos limpiando el contenedor.
      }
      this.calendar = undefined;
    }
    const host = this.calendarEl?.nativeElement;
    if (host) {
      host.innerHTML = '';
    }
  }

  private initCalendar(fechaForzada?: Date): void {
    // Reutilizar el mismo contenedor con el DOM de la instancia anterior dejaba
    // la rejilla duplicada y los números de día tapados.
    this.destroyCalendar();

    const saved = this.calendarState.obtener();
    this.currentView = saved?.view ?? 'week';
    const fechaRestaurada = fechaForzada ?? (saved ? this.calendarState.aFecha(saved.date) : null);

    const cal = new Calendar(this.calendarEl.nativeElement, {
      defaultView: this.currentView,
      usageStatistics: false,
      isReadOnly: true,
      calendars: [
        {
          id: 'tareas',
          name: 'Tareas',
          backgroundColor: '#062e86',
          borderColor: '#062e86',
          color: '#ffffff'
        },
        {
          id: 'tickets',
          name: 'Tickets',
          backgroundColor: '#ec9811',
          borderColor: '#ec9811',
          color: '#ffffff'
        }
      ],
      week: {
        startDayOfWeek: 1,
        dayNames: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
        // Las 24 h completas. Con hourStart: 7 / hourEnd: 24 la rejilla
        // empezaba a las 7, y cualquier evento anterior (por ejemplo una
        // revision a las 06:00) no se veia en las vistas de dia y semana aunque
        // el backend lo devolviera: parecian eventos perdidos.
        hourStart: 0,
        hourEnd: 24,
        showTimezoneCollapseButton: false,
        taskView: false,
        // 'allday' es lo que pinta la fila de eventos de día completo. Sin esta
        // entrada el componente no se monta aunque haya tareas sin fecha, que es
        // justo lo que hace el backend cuando start y due vienen nulos.
        eventView: ['time', 'allday']
      },
      // La cabecera de la fila de día completo decía "All day", en inglés, en
      // una aplicación que va toda en español. La opción es "template" (singular)
      // y vive en la raíz, no dentro de "week".
      template: {
        alldayTitle: () => 'Todo el día',
        time: (ev: EventObject) => plantillaEvento(ev, true),
        allday: (ev: EventObject) => plantillaEvento(ev, false),
        // Contador de eventos que no caben en la fila de día completo.
        weekGridFooterExceed: (n: number) => `+${n} más`
      },
      month: {
        startDayOfWeek: 1,
        dayNames: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
        visibleWeeksCount: 6,
        isAlways6Weeks: false
      },
      theme: this.currentTheme === 'dark' ? calendarDarkTheme() : calendarLightTheme()
    });

    // El detalle se abre en un panel lateral y no en un SweetAlert: el título lo
    // escribe quien abre el ticket y el SweetAlert lo pintaba como HTML sin
    // escapar. Además el panel deja enlaces al ticket o a la tarea.
    cal.on('clickEvent', ({ event }) => {
      const id = (event as unknown as { id: string }).id;
      this.zone.run(() => {
        this.seleccionado = this.eventos.find((e) => e.id === id) ?? null;
      });
    });

    // toast-ui 2.1.3 no emite 'changeView': registrarlo no daba error, pero el
    // handler nunca corría y por eso la fecha no se guardaba sola. El clic en el
    // nombre del día (L M X J V S) sí es un evento real y también mueve la fecha.
    cal.on('clickDayName', () => {
      this.updateRangeLabel();
      this.reloadForRange();
      this.persistState();
    });

    // this.calendar se asigna antes de setDate: el constructor de ToastUI ya hizo
    // un primer render y los handlers necesitan la instancia para leer la fecha.
    this.calendar = cal;

    // ToastUI no admite fecha en las opciones: sin esto siempre abriría en "hoy".
    if (fechaRestaurada) {
      cal.setDate(fechaRestaurada);
    }

    // El tema ya entró en el constructor, así que la primera rejilla ya sale con
    // los colores correctos y no hay un primer render sin tema.
    cal.render();
    this.reloadForRange();
    this.cargarResumenHoy();
  }

  /** Cambia entre vista: 'week' | 'day' | 'month' */
  setView(view: CalendarView): void {
    if (this.currentView === view) return;
    this.currentView = view;
    this.calendar?.changeView(view);
    this.transicion(0);
    setTimeout(() => {
      // La altura mínima depende de la vista; se repinta tras aplicarla.
      this.calendar?.render();
      this.persistState();
      this.reloadForRange();
    });
  }

  prev(): void {
    this.calendar?.prev();
    this.transicion(-1);
    setTimeout(() => {
      this.persistState();
      this.reloadForRange();
    });
  }

  next(): void {
    this.calendar?.next();
    this.transicion(1);
    setTimeout(() => {
      this.persistState();
      this.reloadForRange();
    });
  }

  today(): void {
    this.calendar?.today();
    this.transicion(0);
    setTimeout(() => {
      this.persistState();
      this.reloadForRange();
    });
  }

  /**
   * Fundido corto al cambiar de rango o de vista, con un leve desplazamiento en
   * la dirección del cambio (atrás desde la izquierda, adelante desde la
   * derecha). Sin él, la rejilla se reemplaza de golpe y no se nota que cambió
   * de semana. Se anima el contenedor, no el DOM de ToastUI, con la Web
   * Animations API para no tener que recrear nada.
   */
  private transicion(direccion: -1 | 0 | 1): void {
    const host = this.calendarEl?.nativeElement;
    if (!host?.animate) return;
    const desde = this.reducido || direccion === 0 ? 'none' : `translateX(${direccion * 12}px)`;
    host.animate(
      [{ opacity: 0.35, transform: desde }, { opacity: 1, transform: 'none' }],
      { duration: this.reducido ? 120 : 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
  }

  // ============================ Panel de detalle ============================

  cerrarDetalle(): void {
    this.seleccionado = null;
  }

  urgencia(e: CalendarEvent): Urgencia {
    return urgenciaDe(e);
  }

  /** Fecha legible en español para el panel. */
  fechaLarga(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /** "Venció hace 3 h", "Vence en 40 min"… para el panel. */
  plazo(e: CalendarEvent): string {
    const fin = new Date(e.end).getTime();
    if (!Number.isFinite(fin)) return '';
    const diff = fin - Date.now();
    const min = Math.round(Math.abs(diff) / 60_000);
    const texto = min < 60 ? `${min} min` : min < 60 * 48 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} días`;
    return diff < 0 ? `Venció hace ${texto}` : `Vence en ${texto}`;
  }

  estadoLegible(estado: string | null | undefined): string {
    return (estado || '').replace(/_/g, ' ').toLowerCase();
  }

  // ============================ Resumen de hoy ============================

  /** Cuenta lo de hoy aparte del rango visible: el resumen no cambia al navegar. */
  private cargarResumenHoy(): void {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
    const params = new HttpParams().set('start', inicio.toISOString()).set('end', fin.toISOString());
    this.http.get<CalendarEvent[]>(`${environment.apiUrl}/calendar/events`, { params }).subscribe({
      next: (lista) => {
        const eventos = lista ?? [];
        const ahora = Date.now();
        this.hoy = {
          total: eventos.length,
          vencidos: eventos.filter((e) => urgenciaDe(e, ahora) === 'VENCIDO').length,
          proximos: eventos.filter((e) => urgenciaDe(e, ahora) === 'PROXIMO').length,
        };
      },
      error: () => (this.hoy = null),
    });
  }

  /** Texto del aviso cuando el rango visible no tiene eventos. */
  get textoVacio(): string {
    return this.currentView === 'day' ? 'Nada programado este día'
      : this.currentView === 'month' ? 'Nada programado este mes'
        : 'Semana despejada';
  }

  /** Guardar la fecha mostrada para restaurarla al volver a entrar al calendario. */
  private persistState = (): void => {
    if (!this.calendar) return;
    this.calendarState.guardar(this.calendar.getDate().toDate(), this.currentView);
  };

  private reloadForRange(): void {
    if (!this.calendar) return;

    const start: Date = this.calendar.getDateRangeStart().toDate();
    const end: Date = this.calendar.getDateRangeEnd
      ? this.calendar.getDateRangeEnd().toDate()
      : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    this.updateRangeLabel();

    const params = new HttpParams()
      .set('start', start.toISOString())
      .set('end', end.toISOString());

    this.http
      .get<CalendarEvent[]>(`${environment.apiUrl}/calendar/events`, { params })
      .subscribe({
        next: (events) => {
          this.calendar?.clear();
          this.eventos = events ?? [];
          this.cargado = true;
          if (this.eventos.length) {
            this.calendar?.createEvents(this.eventos.map(toToastEvent));
          }
          this.construirLeyenda();
        },
        error: () =>
          this.toastService.error('No se pudieron cargar los eventos')
      });
  }

  /**
   * Leyenda deducida de los eventos realmente cargados. Antes era fija con dos
   * colores (azul = tareas, naranja = tickets) pero las tareas toman su propio
   * color y los tickets el de la prioridad, asi que la leyenda no cuadtaba con lo
   * que se veia en pantalla.
   *
   * Cada color se etiqueta con su tipo y su estado (por ejemplo "Tarea · En
   * curso"), porque un numero suelto no dice nada: con la cuenta sola no se
   * sabe si el 7 son tareas o tickets.
   */
  private construirLeyenda(): void {
    const grupos = new Map<string, { color: string; count: number; tipo: string; estado: string }>();
    for (const e of this.eventos) {
      const color = (e.color || '').trim();
      if (!color) continue;
      const clave = color.toLowerCase();
      const previo = grupos.get(clave);
      if (previo) {
        previo.count++;
        continue;
      }
      grupos.set(clave, {
        color,
        count: 1,
        tipo: e.type === 'TICKET' ? 'Ticket' : 'Tarea',
        estado: (e.status || '').replace(/_/g, ' ').toLowerCase()
      });
    }
    this.leyenda = [...grupos.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  /** Eventos cargados en el rango visible; alimentan la leyenda. */
  private eventos: CalendarEvent[] = [];
  /** Colores realmente en pantalla, con su conteo y a que corresponden. */
  leyenda: { color: string; count: number; tipo: string; estado: string }[] = [];

  /** Total de eventos del rango, para el encabezado de la leyenda. */
  get eventosVisibles(): number {
    return this.eventos.length;
  }

  private updateRangeLabel(): void {
    if (!this.calendar) return;

    const start = this.calendar.getDateRangeStart().toDate();
    const end = this.calendar.getDateRangeEnd
      ? this.calendar.getDateRangeEnd().toDate()
      : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

    // La formateacion vive en calendar-state.service para que el encabezado y
    // cualquier otro uso del rango no se dupliquen (y no se vuelvan a divergir).
    this.rangeLabel = etiquetaRango(start, end, this.currentView);
  }
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function calendarLightTheme(): CalendarTheme {
  return {
    common: {
      backgroundColor: '#ffffff',
      border: '#e5e7eb',
      dayName: { color: '#374151' },
      holiday: { color: '#ec9811' },
      saturday: { color: '#374151' },
      today: { color: '#062e86' }
    },
    week: {
      dayName: {
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        backgroundColor: 'transparent'
      },
      dayGrid: { borderRight: '1px solid #e5e7eb', backgroundColor: '#ffffff' },
      dayGridLeft: { borderRight: '1px solid #e5e7eb', backgroundColor: '#ffffff', width: '80px' },
      timeGrid: { borderRight: '1px solid #e5e7eb' },
      timeGridLeft: { borderRight: '1px solid #e5e7eb', backgroundColor: '#ffffff', width: '80px' },
      timeGridHalfHourLine: { borderBottom: '1px dashed #e5e7eb' },
      timeGridHourLine: { borderBottom: '1px solid #e5e7eb' },
      nowIndicatorLabel: { color: '#062e86' },
      nowIndicatorPast: { border: '1px dashed #ec9811' },
      nowIndicatorBullet: { backgroundColor: '#ec9811' },
      nowIndicatorToday: { border: '1px solid #062e86' },
      nowIndicatorFuture: { border: '1px dotted #062e86' },
      pastTime: { color: '#9ca3af' },
      futureTime: { color: '#1f2937' },
      weekend: { backgroundColor: 'rgba(0,0,0,0.02)' },
      today: { color: '#062e86', backgroundColor: 'rgba(6,46,134,0.06)' },
      pastDay: { color: '#9ca3af' },
      panelResizer: { border: '1px solid #e5e7eb' },
      gridSelection: { color: '#374151' }
    },
    month: {
      dayExceptThisMonth: { color: 'rgba(0,0,0,0.35)' },
      dayName: { borderLeft: 'none', backgroundColor: 'transparent' },
      holidayExceptThisMonth: { color: 'rgba(236,152,17,0.5)' },
      moreView: {
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      },
      moreViewTitle: { backgroundColor: '#f9fafb' },
      weekend: { backgroundColor: 'rgba(0,0,0,0.02)' }
    }
  };
}

function calendarDarkTheme(): CalendarTheme {
  return {
    common: {
      backgroundColor: '#1f2937',
      border: '#374151',
      dayName: { color: '#cbd5e1' },
      holiday: { color: '#fca5a5' },
      saturday: { color: '#cbd5e1' },
      today: { color: '#ffffff' }
    },
    week: {
      dayName: {
        borderLeft: 'none',
        borderTop: '1px solid #374151',
        borderBottom: '1px solid #374151',
        backgroundColor: '#1f2937'
      },
      dayGrid: { borderRight: '1px solid #374151', backgroundColor: '#1f2937' },
      dayGridLeft: { borderRight: '1px solid #374151', backgroundColor: '#111827', width: '80px' },
      timeGrid: { borderRight: '1px solid #374151' },
      timeGridLeft: { borderRight: '1px solid #374151', backgroundColor: '#111827', width: '80px' },
      timeGridHalfHourLine: { borderBottom: '1px dashed #374151' },
      timeGridHourLine: { borderBottom: '1px solid #374151' },
      nowIndicatorLabel: { color: '#ec9811' },
      nowIndicatorPast: { border: '1px dashed #ec9811' },
      nowIndicatorBullet: { backgroundColor: '#ec9811' },
      nowIndicatorToday: { border: '1px solid #ec9811' },
      nowIndicatorFuture: { border: '1px dotted #ec9811' },
      pastTime: { color: '#6b7280' },
      futureTime: { color: '#cbd5e1' },
      weekend: { backgroundColor: 'rgba(255,255,255,0.04)' },
      today: { color: '#ffffff', backgroundColor: 'rgba(6,46,134,0.4)' },
      pastDay: { color: '#6b7280' },
      panelResizer: { border: '1px solid #374151' },
      gridSelection: { color: '#ffffff' }
    },
    month: {
      dayExceptThisMonth: { color: '#6b7280' },
      dayName: { borderLeft: 'none', backgroundColor: '#1f2937' },
      holidayExceptThisMonth: { color: 'rgba(252,165,165,0.6)' },
      moreView: {
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        boxShadow: '0 6px 16px rgba(0,0,0,0.5)'
      },
      moreViewTitle: { backgroundColor: '#111827' },
      weekend: { backgroundColor: 'rgba(255,255,255,0.04)' }
    }
  };
}

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toToastEvent(e: CalendarEvent): EventObject {
  const calendarId = e.type === 'TICKET' ? 'tickets' : 'tareas';
  const creado = e.createdAt ? new Date(e.createdAt) : null;
  // ToastUI no dibuja la hora en los eventos de todo el dia, por lo que la
  // hora de creacion se antepone al titulo para que la fecha siga visible.
  const titulo =
    e.allDay && creado
      ? `${pad(creado.getHours())}:${pad(creado.getMinutes())} - ${e.title}`
      : e.title;

  // Un evento de todo el dia debe abarcar el dia entero: de 00:00:00 a
  // 23:59:59. El backend devuelve inicio y fin dentro del mismo dia, asi que
  // se reconstruyen los dos extremos sobre la fecha del evento. Antes se
  // pasaba solo la fecha y ToastUI lo cerraba a las 00:00:00, con lo que la
  // barra quedaba de ancho cero y el evento parecia no existir.
  // El backend ya devuelve los eventos de día completo con la jornada entera
  // (00:00:00 a 23:59:59), así que aquí solo se pasa tal cual. Antes se
  // reconstruían aquí y además ToastUI cerraba el evento a las 00:00:00, con lo
  // que la barra quedaba de ancho cero.
  return {
    id: e.id,
    calendarId,
    title: titulo,
    start: toLocalDateTime(e.start),
    end: toLocalDateTime(e.end),
    isAllDay: e.allDay,
    backgroundColor: e.color,
    // Lo vencido lleva el borde rojo además del punto: se distingue también
    // sin depender del color de fondo y en la vista de mes, donde el punto es
    // pequeño.
    borderColor: urgenciaDe(e) === 'VENCIDO' ? '#dc2626' : e.color,
    color: '#ffffff',
    raw: { refType: e.type, status: e.status, createdAt: e.createdAt, urgencia: urgenciaDe(e) } as never
  };
}
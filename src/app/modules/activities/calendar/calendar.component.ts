import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import Calendar, { EventObject } from '@toast-ui/calendar';
import Swal from 'sweetalert2';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CalendarEvent } from '../../../models/task.model';

type CalendarView = 'week' | 'day' | 'month';

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

  constructor(private http: HttpClient) { }

  ngAfterViewInit(): void {
    setTimeout(() => this.initCalendar());
  }

  ngOnDestroy(): void {
    this.calendar?.destroy();
  }

  private initCalendar(): void {
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
        hourStart: 7,
        hourEnd: 24,
        showTimezoneCollapseButton: false,
        taskView: false,
        eventView: ['time']
      },
      month: {
        startDayOfWeek: 1,
        dayNames: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
        visibleWeeksCount: 6,
        isAlways6Weeks: false
      },
      theme: {
        common: {
          gridSelection: {
            backgroundColor: 'rgba(6,46,134,0.18)',
            border: '1px solid #062e86'
          },
          today: { color: '#062e86' },
          dayName: {
            borderLeft: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            fontWeight: '600'
          }
        },
        week: {
          today: {
            color: '#062e86',
            backgroundColor: 'rgba(6,46,134,0.06)'
          },
          nowIndicatorLabel: { color: '#062e86' },
          nowIndicatorPast: { border: '1px dashed #ec9811' },
          nowIndicatorBullet: { backgroundColor: '#ec9811' },
          pastTime: { opacity: 0.5 },
          futureTime: { opacity: 1 },
          dayName: {
            borderLeft: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            fontWeight: '600'
          },
          timeGridLeft: { borderRight: '1px solid #e5e7eb' }
        },
        month: {
          dayName: {
            borderLeft: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            fontWeight: '600'
          },
          dayExceptThisMonth: { color: 'rgba(0,0,0,0.35)' },
          holiday: { color: '#ec9811' },
          moreView: {
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            backgroundColor: '#ffffff'
          },
          moreViewTitle: {
            backgroundColor: '#f9fafb'
          },
          weekend: { backgroundColor: 'rgba(0,0,0,0.02)' }
        }
      }
    });

    cal.on('clickEvent', ({ event }) => {
      const raw = event as unknown as {
        id: string;
        title: string;
        start: Date;
        end: Date;
        raw?: { refType?: string; status?: string };
      };
      const refType = raw.raw?.refType === 'TICKET' ? 'Ticket' : 'Tarea';
      const inicio = formatDateTime(new Date(raw.start));
      const fin = formatDateTime(new Date(raw.end));
      const statusHtml = raw.raw?.status
        ? `<span class="block mt-1"><b>Estado:</b> ${raw.raw.status}</span>`
        : '';

      Swal.fire({
        title: raw.title,
        html: `
          <span class="block"><b>Tipo:</b> ${refType}</span>
          <span class="block"><b>Inicio:</b> ${inicio}</span>
          <span class="block"><b>Fin:</b> ${fin}</span>
          ${statusHtml}
        `,
        icon: refType === 'Ticket' ? 'warning' : 'info',
        confirmButtonColor: '#062e86'
      });
    });

    cal.on('changeView', () => this.updateRangeLabel());

    this.calendar = cal;
    this.reloadForRange();
  }

  /** Cambia entre vista: 'week' | 'day' | 'month' */
  setView(view: CalendarView): void {
    if (this.currentView === view) return;
    this.currentView = view;
    this.calendar?.changeView(view);
    setTimeout(() => this.reloadForRange());
  }

  prev(): void {
    this.calendar?.prev();
    setTimeout(() => this.reloadForRange());
  }

  next(): void {
    this.calendar?.next();
    setTimeout(() => this.reloadForRange());
  }

  today(): void {
    this.calendar?.today();
    setTimeout(() => this.reloadForRange());
  }

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
          if (events && events.length) {
            this.calendar?.createEvents(events.map(toToastEvent));
          }
        },
        error: () =>
          Swal.fire('Error', 'No se pudieron cargar los eventos', 'error')
      });
  }

  private updateRangeLabel(): void {
    if (!this.calendar) return;

    const start = this.calendar.getDateRangeStart().toDate();
    const end = this.calendar.getDateRangeEnd
      ? this.calendar.getDateRangeEnd().toDate()
      : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    if (this.currentView === 'month') {
      this.rangeLabel = `${months[start.getMonth()]} ${start.getFullYear()}`;
      return;
    }

    if (this.currentView === 'day') {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      this.rangeLabel = `${days[start.getDay()]} ${start.getDate()} ${months[start.getMonth()]} ${start.getFullYear()}`;
      return;
    }

    const sameMonth = start.getMonth() === end.getMonth();
    const sameYear = start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      this.rangeLabel = `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]} ${start.getFullYear()}`;
    } else if (sameYear) {
      this.rangeLabel = `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]} ${start.getFullYear()}`;
    } else {
      this.rangeLabel = `${start.getDate()} ${months[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
    }
  }
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function formatDateTime(d: Date): string {
  return `${pad(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toToastEvent(e: CalendarEvent): EventObject {
  const calendarId = e.type === 'TICKET' ? 'tickets' : 'tareas';
  return {
    id: e.id,
    calendarId,
    title: e.title,
    start: e.allDay ? e.start.substring(0, 10) : toLocalDateTime(e.start),
    end: e.allDay ? e.end.substring(0, 10) : toLocalDateTime(e.end),
    isAllDay: e.allDay,
    bgColor: e.color,
    borderColor: e.color,
    color: '#ffffff',
    raw: { refType: e.type, status: e.status } as never
  };
}
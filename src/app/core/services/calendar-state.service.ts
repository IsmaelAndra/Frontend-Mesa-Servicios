import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type CalendarView = 'week' | 'day' | 'month';

export interface CalendarState {
  /** yyyy-MM-dd en hora local. */
  date: string;
  view: CalendarView;
}

const KEY = 'mesa_ayuda_calendar';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Guarda la fecha y la vista del calendario.
 *
 * Vive como servicio root y además en sessionStorage: el servicio sobrevive aunque
 * el componente se destruya en un orden inesperado, y el sessionStorage cubre
 * además el recargón duro de la página. Antes la fecha solo vivía dentro de la
 * instancia de ToastUI, que se destruye en cada navegación, por eso se perdía.
 */
@Injectable({ providedIn: 'root' })
export class CalendarStateService {
  private readonly state = new BehaviorSubject<CalendarState | null>(null);

  readonly state$ = this.state.asObservable();

  constructor() {
    this.state.next(this.leerDeStorage());
  }

  /** Actualiza la sesión con lo que se está mostrando en pantalla. */
  guardar(date: Date | null, view: CalendarView): void {
    if (!date || isNaN(date.getTime())) return;
    const nuevo: CalendarState = { date: this.clave(date), view };
    this.state.next(nuevo);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(nuevo));
    } catch {
      // almacenamiento bloqueado: el servicio en memoria igual conserva la fecha
    }
  }

  /** Fecha y vista a restaurar; null si nunca se guardó nada. */
  obtener(): CalendarState | null {
    return this.state.value;
  }

  limpiar(): void {
    this.state.next(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nada que limpiar
    }
  }

  /** Convierte "2026-10-05" en un Date local, sin el corrimiento de zona de new Date(string). */
  aFecha(clave: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clave || '');
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  private clave(d: Date): string {
    const mes = d.getMonth() + 1 < 10 ? `0${d.getMonth() + 1}` : `${d.getMonth() + 1}`;
    const dia = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private leerDeStorage(): CalendarState | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const view: CalendarView =
        parsed.view === 'day' || parsed.view === 'month' || parsed.view === 'week'
          ? parsed.view
          : 'week';
      return parsed.date ? { date: parsed.date, view } : null;
    } catch {
      return null;
    }
  }
}

/** "12 - 18 Octubre 2026" o "Octubre 2026", para el encabezado del calendario. */
export function etiquetaRango(desde: Date, hasta: Date, view: CalendarView): string {
  if (view === 'month') {
    return `${MESES[desde.getMonth()]} ${desde.getFullYear()}`;
  }
  if (view === 'day') {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${dias[desde.getDay()]} ${desde.getDate()} ${MESES[desde.getMonth()]} ${desde.getFullYear()}`;
  }
  if (desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()) {
    return `${desde.getDate()} - ${hasta.getDate()} ${MESES[desde.getMonth()]} ${desde.getFullYear()}`;
  }
  if (desde.getFullYear() === hasta.getFullYear()) {
    return `${desde.getDate()} ${MESES[desde.getMonth()]} - ${hasta.getDate()} ${MESES[hasta.getMonth()]} ${desde.getFullYear()}`;
  }
  return `${desde.getDate()} ${MESES[desde.getMonth()]} ${desde.getFullYear()} - ${hasta.getDate()} ${MESES[hasta.getMonth()]} ${hasta.getFullYear()}`;
}

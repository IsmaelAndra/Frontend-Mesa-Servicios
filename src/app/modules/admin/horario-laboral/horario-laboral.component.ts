import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';
import { confirmar } from '../../../core/utils/confirmar.util';

interface DiaHorario {
  dia: number;
  inicio: string;
  fin: string;
  activo: boolean;
}

interface Feriado {
  idFeriado: string;
  fechaFeriado: string;
  nombreFeriado: string;
  anualFeriado: boolean;
}

/**
 * Horario laboral y feriados del SLA (V49), pestaña de "SLA y escalaciones".
 * Las políticas con "horario laboral" solo cuentan el tiempo dentro de este
 * horario y fuera de los feriados. Solo el SUPER_ADMIN lo cambia; el jefe lo ve.
 */
@Component({
  selector: 'app-horario-laboral',
  templateUrl: './horario-laboral.component.html',
})
export class HorarioLaboralComponent implements OnInit {
  /** El jefe lo ve sin poder cambiarlo. */
  @Input() soloLectura = false;

  readonly nombresDia = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  dias: DiaHorario[] = [];
  feriados: Feriado[] = [];
  cargando = true;
  guardando = false;
  nuevo = { fecha: '', nombre: '', anual: false };
  private readonly url = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.http.get<{ diaHorario: number; inicioHorario: string; finHorario: string; activoHorario: boolean }[]>(`${this.url}/horario-laboral`).subscribe({
      next: (l) => {
        const porDia = new Map((l || []).map((h) => [h.diaHorario, h]));
        this.dias = [1, 2, 3, 4, 5, 6, 7].map((d) => {
          const h = porDia.get(d);
          return { dia: d, inicio: (h?.inicioHorario || '08:00').slice(0, 5), fin: (h?.finHorario || '17:00').slice(0, 5), activo: h ? h.activoHorario : d <= 5 };
        });
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.toast.error('No se pudo cargar el horario laboral'); },
    });
    this.http.get<Feriado[]>(`${this.url}/feriados`).subscribe({
      // En orden de calendario; los anuales cuentan en el año en curso.
      next: (l) => {
        const anio = String(new Date().getFullYear());
        const clave = (f: Feriado) => (f.anualFeriado ? anio + f.fechaFeriado.slice(4) : f.fechaFeriado);
        this.feriados = (l || []).sort((a, b) => clave(a).localeCompare(clave(b)));
      },
      error: () => undefined,
    });
  }

  /** Horas laborables a la semana, para el resumen. */
  get horasSemana(): number {
    const min = this.dias.filter((d) => d.activo).reduce((s, d) => s + Math.max(0, this.minutos(d.fin) - this.minutos(d.inicio)), 0);
    return Math.round((min / 60) * 10) / 10;
  }

  private minutos(hhmm: string): number {
    const [h, m] = (hhmm || '0:0').split(':').map(Number);
    return h * 60 + (m || 0);
  }

  guardarHorario(): void {
    if (this.dias.some((d) => d.activo && this.minutos(d.fin) <= this.minutos(d.inicio))) {
      this.toast.warn('La hora de salida debe ser posterior a la de entrada');
      return;
    }
    if (!this.dias.some((d) => d.activo)) {
      this.toast.warn('Debe haber al menos un día laborable');
      return;
    }
    this.guardando = true;
    this.http.put(`${this.url}/horario-laboral`, this.dias).subscribe({
      next: () => { this.guardando = false; this.toast.success('Horario laboral guardado. Se aplica a los tickets nuevos.'); },
      error: (e) => { this.guardando = false; this.toast.error(e?.error?.message || 'No se pudo guardar el horario'); },
    });
  }

  agregarFeriado(): void {
    if (!this.nuevo.fecha || !this.nuevo.nombre.trim()) return;
    this.http.post<Feriado>(`${this.url}/feriados`, this.nuevo).subscribe({
      next: () => { this.nuevo = { fecha: '', nombre: '', anual: false }; this.toast.success('Feriado agregado'); this.cargar(); },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo agregar el feriado'),
    });
  }

  async eliminarFeriado(f: Feriado): Promise<void> {
    const ok = await confirmar({ titulo: '¿Eliminar el feriado?', texto: `${f.nombreFeriado} (${this.fecha(f)})`, accion: 'Eliminar' });
    if (!ok) return;
    this.http.delete(`${this.url}/feriados/${f.idFeriado}`).subscribe({
      next: () => { this.toast.success('Feriado eliminado'); this.cargar(); },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  /** "25/12" (anual, con insignia) o "08/02/2027". Fecha sin hora como día local. */
  fecha(f: Feriado): string {
    const [y, m, d] = f.fechaFeriado.split('-');
    return f.anualFeriado ? `${d}/${m}` : `${d}/${m}/${y}`;
  }

  trackDia(_: number, d: DiaHorario): number {
    return d.dia;
  }

  trackFeriado(_: number, f: Feriado): string {
    return f.idFeriado;
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, debounceTime } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SseService } from '../../../core/services/sse.service';
import { duracionLegible } from '../../../core/utils/duracion.util';

export type EstadoSla = 'VENCIDO' | 'EN_RIESGO' | 'EN_TIEMPO';

export interface ItemPanelSla {
  id: string;
  numero: number;
  titulo: string;
  confidencial: boolean;
  prioridad: string | null;
  prioridadColor: string | null;
  estado: string | null;
  agente: string | null;
  area: string | null;
  politica: string | null;
  horarioLaboral: boolean;
  respuestaVence: string | null;
  respondido: boolean;
  resolucionVence: string | null;
  pctConsumido: number;
  minutosRestantes: number;
  estadoSla: EstadoSla;
  creado: string;
}

export interface AgentePanelSla {
  nombre: string;
  abiertos: number;
  vencidos: number;
  enRiesgo: number;
}

export interface PanelSla {
  generado: string;
  total: number;
  vencidos: number;
  enRiesgo: number;
  enTiempo: number;
  sinAgente: number;
  sinRespuesta: number;
  porAgente: AgentePanelSla[];
  tickets: ItemPanelSla[];
  umbralRiesgo: number;
}

const ORDEN: Record<EstadoSla, number> = { VENCIDO: 0, EN_RIESGO: 1, EN_TIEMPO: 2 };

/**
 * Panel de SLA en tiempo real (V49): tickets abiertos del área del jefe (todo
 * para súper admin y auditor) ordenados por urgencia. Se actualiza con cada
 * evento de ticket y, como respaldo, cada minuto.
 */
@Component({
  selector: 'app-panel-sla',
  templateUrl: './panel-sla.component.html',
})
export class PanelSlaComponent implements OnInit, OnDestroy {
  panel: PanelSla | null = null;
  cargando = true;
  error = false;
  filtro: EstadoSla | 'TODOS' | 'SIN_AGENTE' = 'TODOS';
  buscar = '';
  private subs = new Subscription();

  constructor(private http: HttpClient, private sse: SseService) {}

  ngOnInit(): void {
    this.cargar();
    this.subs.add(interval(60_000).subscribe(() => this.cargar(true)));
    this.subs.add(this.sse.ticketEvent$.pipe(debounceTime(1500)).subscribe(() => this.cargar(true)));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  cargar(silencioso = false): void {
    if (!silencioso) this.cargando = true;
    this.http.get<PanelSla>(`${environment.apiUrl}/tickets/sla/panel`).subscribe({
      next: (p) => { this.panel = p; this.cargando = false; this.error = false; },
      error: () => { this.cargando = false; this.error = !this.panel; },
    });
  }

  /** Lista filtrada y ordenada: vencidos primero, luego lo que menos tiempo le queda. */
  get tickets(): ItemPanelSla[] {
    const q = this.buscar.trim().toLowerCase().replace(/^#/, '');
    return (this.panel?.tickets || [])
      .filter((t) => this.filtro === 'TODOS'
        || (this.filtro === 'SIN_AGENTE' ? !t.agente : t.estadoSla === this.filtro))
      .filter((t) => !q || String(t.numero) === q
        || `${t.titulo} ${t.agente || ''} ${t.area || ''}`.toLowerCase().includes(q))
      .sort((a, b) => ORDEN[a.estadoSla] - ORDEN[b.estadoSla] || a.minutosRestantes - b.minutosRestantes);
  }

  /** "Vencido hace 2 h" / "Quedan 45 min". Minutos hábiles si la política usa horario laboral. */
  restante(t: ItemPanelSla): string {
    if (t.minutosRestantes < 0) return `Vencido hace ${duracionLegible(-t.minutosRestantes)}`;
    return `Quedan ${duracionLegible(Math.max(1, t.minutosRestantes))}`;
  }

  claseEstado(e: EstadoSla): string {
    return e === 'VENCIDO' ? 'badge-error' : e === 'EN_RIESGO' ? 'badge-warning' : 'badge-success';
  }

  etiquetaEstado(e: EstadoSla): string {
    return e === 'VENCIDO' ? 'Vencido' : e === 'EN_RIESGO' ? 'En riesgo' : 'A tiempo';
  }

  iconoEstado(e: EstadoSla): string {
    return e === 'VENCIDO' ? 'fa-solid fa-circle-exclamation' : e === 'EN_RIESGO' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check';
  }

  colorBarra(t: ItemPanelSla): string {
    return t.estadoSla === 'VENCIDO' ? 'progress-error' : t.estadoSla === 'EN_RIESGO' ? 'progress-warning' : 'progress-success';
  }

  /** Carga relativa de cada agente para la barra (el que más tiene = 100 %). */
  pctCarga(a: AgentePanelSla): number {
    const max = Math.max(1, ...(this.panel?.porAgente || []).map((x) => x.abiertos));
    return Math.round((a.abiertos / max) * 100);
  }

  trackTicket(_: number, t: ItemPanelSla): string {
    return t.id;
  }

  trackAgente(_: number, a: AgentePanelSla): string {
    return a.nombre;
  }
}

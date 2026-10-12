import { Injectable } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { SseService } from './sse.service';
import { WorkflowService } from './workflow.service';
import {
  FinAnimable,
  PasoAnimable,
  WorkflowExecution,
  WorkflowNodeRun,
  WorkflowPasoEvento,
} from '../../models/workflow.model';

/** Lo que se sabe en cada momento de una ejecución que se está siguiendo. */
export interface EstadoVivo {
  pasos: PasoAnimable[];
  fin: FinAnimable | null;
}

/** Estados en los que la vuelta del motor ya terminó (aunque la ejecución siga en pausa). */
const ESTADOS_DE_CIERRE = ['COMPLETADO', 'ERROR', 'CANCELADO', 'ESPERANDO', 'APROBACION'];

/**
 * Sigue una ejecución de workflow mientras corre.
 *
 * <p>Junta dos fuentes: el SSE, que trae cada paso al instante, y el historial
 * (`/pasos`), que es la verdad guardada. El SSE puede no llegar (conexión caída,
 * otra pestaña), así que se consulta también el historial cada poco hasta que la
 * vuelta termina. Si los dos dicen algo del mismo paso, gana el historial.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowEnVivoService {
  /** Cada cuánto se consulta el historial mientras la ejecución corre. */
  private static readonly CONSULTA_MS = 2500;

  constructor(
    private sse: SseService,
    private workflowService: WorkflowService
  ) {}

  /** Convierte los pasos guardados al formato que anima el lienzo. */
  static desdeHistorial(runs: WorkflowNodeRun[]): PasoAnimable[] {
    return runs.map((r) => {
      const entrada = WorkflowEnVivoService.leer(r.input);
      const duracion = r.startedAt && r.finishedAt
        ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()
        : null;
      return {
        secuencia: r.sequence,
        nodeId: r.nodeId,
        nodeType: r.nodeType,
        estado: r.status,
        puerto: typeof entrada?.['puerto'] === 'string' ? (entrada['puerto'] as string) : null,
        motivo: r.errorMessage,
        salida: WorkflowEnVivoService.leer(r.output),
        duracionMs: duracion,
      };
    });
  }

  /** Fin de la vuelta según la ejecución guardada; null si sigue corriendo. */
  static finDe(e: WorkflowExecution): FinAnimable | null {
    if (!ESTADOS_DE_CIERRE.includes(e.status)) return null;
    let motivo = e.errorMessage ?? null;
    if (!motivo && e.result) {
      try {
        motivo = JSON.parse(e.result)?.motivo ?? null;
      } catch {
        // resultado ilegible: se queda sin motivo
      }
    }
    return { estado: e.status, motivo };
  }

  private static leer(texto: string | null | undefined): Record<string, unknown> | null {
    if (!texto) return null;
    try {
      const v = JSON.parse(texto);
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Emite el estado de la ejecución cada vez que cambia. Termina sola cuando la
   * vuelta del motor se cierra (completada, error o pausa).
   */
  seguir(executionId: string): Observable<EstadoVivo> {
    return new Observable<EstadoVivo>((obs) => {
      const pasos = new Map<number, PasoAnimable>();
      let fin: FinAnimable | null = null;
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      let cerrado = false;

      const emitir = () => {
        obs.next({
          pasos: [...pasos.values()].sort((a, b) => a.secuencia - b.secuencia),
          fin,
        });
      };

      const terminar = () => {
        if (cerrado) return;
        cerrado = true;
        if (temporizador) clearTimeout(temporizador);
        sub.unsubscribe();
        obs.complete();
      };

      const alEvento = (ev: WorkflowPasoEvento) => {
        if (ev.executionId !== executionId || cerrado) return;
        if (ev.tipo === 'FIN') {
          fin = { estado: ev.estado, motivo: ev.motivo };
          emitir();
          // Se confirma con el historial antes de cerrar: trae la salida
          // completa de cada paso y corrige lo que el SSE se haya perdido.
          consultar(true);
          return;
        }
        if (ev.secuencia == null || !ev.nodeId) return;
        const previo = pasos.get(ev.secuencia);
        // Un NODO_INICIO tardío no pisa un paso que ya terminó.
        if (ev.tipo === 'NODO_INICIO' && previo && previo.estado !== 'EJECUTANDO') return;
        pasos.set(ev.secuencia, {
          secuencia: ev.secuencia,
          nodeId: ev.nodeId,
          nodeType: ev.nodeType ?? previo?.nodeType ?? '',
          estado: ev.estado,
          puerto: ev.puerto ?? previo?.puerto ?? null,
          motivo: ev.motivo ?? null,
          salida: ev.salida ?? previo?.salida ?? null,
          duracionMs: ev.duracionMs ?? null,
        });
        emitir();
      };

      const consultar = (final = false) => {
        if (cerrado) return;
        forkJoin({
          e: this.workflowService.ejecucionDetalle(executionId),
          runs: this.workflowService.pasos(executionId),
        }).subscribe({
          next: ({ e, runs }) => {
            if (cerrado) return;
            for (const p of WorkflowEnVivoService.desdeHistorial(runs)) pasos.set(p.secuencia, p);
            fin = WorkflowEnVivoService.finDe(e) ?? (final ? fin : null);
            emitir();
            if (fin) {
              terminar();
            } else {
              temporizador = setTimeout(() => consultar(), WorkflowEnVivoService.CONSULTA_MS);
            }
          },
          error: () => {
            if (!cerrado) temporizador = setTimeout(() => consultar(), WorkflowEnVivoService.CONSULTA_MS * 2);
          },
        });
      };

      const sub = this.sse.workflow$.subscribe(alEvento);
      consultar();
      return () => {
        cerrado = true;
        if (temporizador) clearTimeout(temporizador);
        sub.unsubscribe();
      };
    });
  }
}

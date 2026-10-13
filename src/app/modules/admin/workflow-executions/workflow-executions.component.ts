import { CommonModule } from "@angular/common";
import { SkeletonComponent } from "../../shared/components/skeleton/skeleton.component";
import { SharedModule } from "../../shared/shared.module";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import Swal from "sweetalert2";
import { WorkflowService } from "../../../core/services/workflow.service";
import { ToastService } from "../../../core/services/toast.service";
import { WorkflowEnVivoService } from "../../../core/services/workflow-en-vivo.service";
import { WorkflowRunCanvasComponent } from "../workflow-run-canvas/workflow-run-canvas.component";
import { Subscription } from "rxjs";
import {
  ExecutionStatus,
  FinAnimable,
  PasoAnimable,
  WorkflowDetail,
  WorkflowExecution,
  WorkflowGraph,
  WorkflowNodeRun,
  WorkflowSummary,
} from "../../../models/workflow.model";

/** Una ejecución abierta con su recorrido. */
interface Traza {
  ejecucion: WorkflowExecution;
  pasos: WorkflowNodeRun[];
  /** Grafo de la versión con la que corrió, para pintar el recorrido encima. */
  grafo: WorkflowGraph | null;
}

/**
 * Historial de ejecuciones.
 *
 * <p>Con id en la ruta muestra las de un workflow; sin él, las de todos. Al abrir
 * una ejecución se pinta el grafo de la versión con la que corrió (no la actual:
 * si después se publicó otra, el recorrido tiene que verse sobre el grafo que de
 * verdad se ejecutó) y, sobre él, qué nodos pasaron, cuál falló y dónde espera.
 */
@Component({
  selector: "app-workflow-executions",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, RouterModule, WorkflowRunCanvasComponent, SkeletonComponent, SharedModule],
  templateUrl: "./workflow-executions.component.html",
})
export class WorkflowExecutionsComponent implements OnInit, OnDestroy {
  readonly workflow = signal<WorkflowDetail | null>(null);
  readonly workflows = signal<WorkflowSummary[]>([]);
  readonly ejecuciones = signal<WorkflowExecution[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  tamano = 25;
  readonly filtro = signal<ExecutionStatus | "">("");
  readonly filtroWorkflow = signal<string | null>(null);
  readonly traza = signal<Traza | null>(null);
  readonly pasoAbierto = signal<string | null>(null);
  readonly cargando = signal(true);

  /** Lo que anima el lienzo de ejecución: en vivo si sigue corriendo, si no la repetición. */
  readonly pasosAnim = signal<PasoAnimable[]>([]);
  readonly finAnim = signal<FinAnimable | null>(null);
  readonly modoAnim = signal<"vivo" | "repeticion">("repeticion");
  private seguimiento?: Subscription;

  readonly estados: (ExecutionStatus | "")[] = [
    "",
    "PENDIENTE",
    "EJECUTANDO",
    "ESPERANDO",
    "APROBACION",
    "COMPLETADO",
    "ERROR",
    "CANCELADO",
  ];

  /** null = vista global de todos los workflows. */
  workflowId: string | null = null;
  private refresco?: ReturnType<typeof setInterval>;
  private detallesCache = new Map<string, WorkflowDetail>();

  constructor(
    private workflowService: WorkflowService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private enVivo: WorkflowEnVivoService,
  ) {}

  ngOnInit(): void {
    this.workflowId = this.route.snapshot.paramMap.get("id") || null;
    if (this.workflowId) {
      this.workflowService.detalle(this.workflowId).subscribe({
        next: (d) => {
          this.workflow.set(d);
          this.detallesCache.set(d.id, d);
        },
        error: () => this.toast.error("No se pudo cargar el proceso"),
      });
    } else {
      this.workflowService
        .listar()
        .subscribe({
          next: (l) => this.workflows.set(l),
          error: () => undefined,
        });
    }
    this.cargarEjecuciones();

    // Desde "Probar" se llega con ?ver=<id>: se abre directamente esa ejecución.
    const ver = this.route.snapshot.queryParamMap.get("ver");
    if (ver) {
      this.workflowService
        .ejecucionDetalle(ver)
        .subscribe({ next: (e) => this.verTraza(e), error: () => undefined });
    }
  }

  ngOnDestroy(): void {
    this.pararRefresco();
    this.seguimiento?.unsubscribe();
  }

  cargarEjecuciones(): void {
    this.cargando.set(true);
    const peticion = this.workflowId
      ? this.workflowService.ejecuciones(
          this.workflowId,
          this.filtro() || null,
          this.pagina(),
          this.tamano,
        )
      : this.workflowService.todasLasEjecuciones(
          { workflowId: this.filtroWorkflow(), estado: this.filtro() || null },
          this.pagina(),
          this.tamano,
        );
    peticion.subscribe({
      next: (r) => {
        this.ejecuciones.set(r.content ?? []);
        this.total.set(r.totalElements ?? 0);
        this.cargando.set(false);
      },
      error: () => {
        this.toast.error("No se pudo cargar el historial");
        this.cargando.set(false);
      },
    });
  }

  cambiarFiltro(estado: ExecutionStatus | ""): void {
    this.filtro.set(estado);
    this.pagina.set(0);
    this.cargarEjecuciones();
  }

  cambiarWorkflow(id: string): void {
    this.filtroWorkflow.set(id || null);
    this.pagina.set(0);
    this.cargarEjecuciones();
  }

  /** Paginación del servidor con el paginador común (app-paginator). */
  irAPagina(pagina: number): void {
    if (pagina === this.pagina()) return;
    this.pagina.set(pagina);
    this.cargarEjecuciones();
  }

  cambiarTamano(tamano: number): void {
    this.tamano = tamano;
    this.pagina.set(0);
    this.cargarEjecuciones();
  }

  // ============================ Traza ============================

  verTraza(ejecucion: WorkflowExecution): void {
    this.pasoAbierto.set(null);
    this.prepararAnimacion(ejecucion);
    this.cargarTraza(ejecucion);
    // Mientras siga en marcha se refresca sola: es lo que se mira justo después de "Probar".
    this.pararRefresco();
    this.refresco = setInterval(() => {
      const t = this.traza();
      if (!t || this.esTerminal(t.ejecucion.status)) {
        this.pararRefresco();
        return;
      }
      this.workflowService.ejecucionDetalle(t.ejecucion.id).subscribe({
        next: (e) => this.cargarTraza(e),
        error: () => this.pararRefresco(),
      });
    }, 2000);
  }

  private cargarTraza(ejecucion: WorkflowExecution): void {
    this.workflowService.pasos(ejecucion.id).subscribe({
      next: (pasos) => {
        this.grafoDe(ejecucion, (grafo) =>
          this.traza.set({ ejecucion, pasos, grafo }),
        );
      },
      error: () => this.toast.error("No se pudo cargar la traza"),
    });
  }

  /** Grafo de la versión con la que corrió la ejecución. */
  private grafoDe(
    e: WorkflowExecution,
    listo: (g: WorkflowGraph | null) => void,
  ): void {
    const usar = (d: WorkflowDetail) => {
      const v = d.versions.find((x) => x.id === e.versionId);
      try {
        listo(v ? (JSON.parse(v.definition) as WorkflowGraph) : null);
      } catch {
        listo(null);
      }
    };
    const enCache = this.detallesCache.get(e.workflowId);
    if (enCache) {
      usar(enCache);
      return;
    }
    this.workflowService.detalle(e.workflowId).subscribe({
      next: (d) => {
        this.detallesCache.set(d.id, d);
        usar(d);
      },
      error: () => listo(null),
    });
  }

  cerrarTraza(): void {
    this.pararRefresco();
    this.seguimiento?.unsubscribe();
    this.traza.set(null);
  }

  /**
   * Prepara el lienzo animado. Si la ejecución sigue en marcha se sigue en vivo
   * (SSE + historial); si ya terminó, se reproduce desde el historial.
   */
  private prepararAnimacion(e: WorkflowExecution): void {
    this.seguimiento?.unsubscribe();
    this.pasosAnim.set([]);
    this.finAnim.set(null);
    const corriendo = e.status === "PENDIENTE" || e.status === "EJECUTANDO";
    this.modoAnim.set(corriendo ? "vivo" : "repeticion");
    if (corriendo) {
      this.seguimiento = this.enVivo.seguir(e.id).subscribe((estado) => {
        this.pasosAnim.set(estado.pasos);
        this.finAnim.set(estado.fin);
      });
      return;
    }
    this.seguimiento = this.workflowService.pasos(e.id).subscribe({
      next: (runs) => {
        this.pasosAnim.set(WorkflowEnVivoService.desdeHistorial(runs));
        this.finAnim.set(WorkflowEnVivoService.finDe(e));
      },
      error: () => undefined,
    });
  }

  private pararRefresco(): void {
    if (this.refresco) {
      clearInterval(this.refresco);
      this.refresco = undefined;
    }
  }

  /** JSON legible para la entrada/salida de un paso. */
  json(texto: string | null | undefined): string {
    if (!texto) return "—";
    try {
      const v = JSON.parse(texto);
      if (v && typeof v === "object" && Object.keys(v).length === 0) return "—";
      return JSON.stringify(v, null, 2);
    } catch {
      return texto;
    }
  }

  motivo(e: WorkflowExecution): string | null {
    if (!e.result) return null;
    try {
      return JSON.parse(e.result)?.motivo ?? null;
    } catch {
      return null;
    }
  }

  // ============================ Acciones ============================

  cancelar(ejecucion: WorkflowExecution): void {
    void Swal.fire({
      title: `¿Cancelar la ejecución ${ejecucion.id.slice(0, 8)}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "Volver",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.workflowService.cancelarEjecucion(ejecucion.id).subscribe({
        next: () => {
          this.toast.info("Ejecución cancelada");
          this.cargarEjecuciones();
          if (this.traza()?.ejecucion.id === ejecucion.id) this.cerrarTraza();
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? "No se pudo cancelar"),
      });
    });
  }

  sePuedeCancelar(e: WorkflowExecution): boolean {
    return (
      e.status === "PENDIENTE" ||
      e.status === "EJECUTANDO" ||
      e.status === "ESPERANDO" ||
      e.status === "APROBACION"
    );
  }

  esTerminal(estado: string): boolean {
    return (
      estado === "COMPLETADO" || estado === "ERROR" || estado === "CANCELADO"
    );
  }

  /** Mismo badge que el resto de tablas: daisyUI semantico con su puntito. */
  /** Color de marca del estado: el badge se pinta con fondo tenue, borde y texto de ese color. */
  colorEstado(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "#16A34A";
      case "ERROR":
        return "#DC2626";
      case "CANCELADO":
        return "#64748B";
      case "ESPERANDO":
        return "#D97706";
      case "APROBACION":
        return "#7C3AED";
      case "PENDIENTE":
        return "#0E7490";
      default:
        return "#2563EB";
    }
  }

  /** Nombre del estado en español, para badges y filtros. */
  etiquetaEstado(estado: string): string {
    const nombres: Record<string, string> = {
      PENDIENTE: "Pendiente",
      EJECUTANDO: "Ejecutando",
      ESPERANDO: "Esperando",
      APROBACION: "En aprobación",
      COMPLETADO: "Completado",
      ERROR: "Error",
      CANCELADO: "Cancelado",
      OMITIDO: "Omitido",
    };
    return nombres[estado] ?? estado;
  }

  colorPaso(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "#16A34A";
      case "ERROR":
        return "#DC2626";
      case "EJECUTANDO":
        return "#2563EB";
      default:
        return "#64748B";
    }
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "badge-success text-success-content";
      case "ERROR":
        return "badge-error text-error-content";
      case "CANCELADO":
        return "badge-ghost text-base-content/60";
      case "ESPERANDO":
      case "APROBACION":
        return "badge-warning text-warning-content";
      default:
        return "badge-info text-info-content";
    }
  }

  /** Icono del badge de estado de una ejecucion, acorde a su color. */
  iconoEstado(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "fa-solid fa-circle-check";
      case "ERROR":
        return "fa-solid fa-circle-exclamation";
      case "CANCELADO":
        return "fa-solid fa-ban";
      case "APROBACION":
        return "fa-solid fa-user-check";
      case "ESPERANDO":
        return "fa-regular fa-hourglass-half";
      default:
        return "fa-solid fa-play";
    }
  }

  duracion(e: WorkflowExecution): string {
    const ms =
      e.durationMs ??
      (e.startedAt && e.finishedAt
        ? new Date(e.finishedAt).getTime() - new Date(e.startedAt).getTime()
        : null);
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${Math.round(ms / 60_000)} min`;
  }

  fecha(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleString("es-EC") : "—";
  }

  nombreNodo(t: Traza, nodoId: string | null): string {
    if (!nodoId) return "—";
    return t.grafo?.nodes.find((n) => n.id === nodoId)?.name ?? nodoId;
  }

  /** Clases del badge de estado de un paso (los pasos usan otros nombres). */
  clasePasoBadge(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "badge-success text-success-content";
      case "ERROR":
        return "badge-error text-error-content";
      default:
        return "badge-ghost text-base-content/60";
    }
  }

  /** Icono del badge de un paso, coherente con su badge. */
  iconoPaso(estado: string): string {
    switch (estado) {
      case "COMPLETADO":
        return "fa-solid fa-circle-check";
      case "ERROR":
        return "fa-solid fa-circle-xmark";
      default:
        return "fa-regular fa-circle";
    }
  }
}

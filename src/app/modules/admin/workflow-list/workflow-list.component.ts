import { CommonModule } from "@angular/common";
import { SharedModule } from "../../shared/shared.module";
import { MasterOption } from "../../shared/components/master-select/master-select.component";
import { MODOS_PROGRAMACION, opcionDisparador } from "../../../core/utils/opciones-select.util";
import { SkeletonComponent } from "../../shared/components/skeleton/skeleton.component";
import { Component, OnInit, computed, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import Swal from "sweetalert2";
import {
  WorkflowService,
  WorkflowCreateRequest,
} from "../../../core/services/workflow.service";
import { ToastService } from "../../../core/services/toast.service";
import {
  ScheduleConfig,
  WorkflowSummary,
} from "../../../models/workflow.model";

/**
 * Listado de procesos y alta.
 *
 * <p>El alta es solo metadatos: nombre, disparador y una frase. El grafo se dibuja
 * después. Pedirlo todo de golpe dejaría un formulario con un hueco gigante
 * donde va el proceso, y casi nadie lo llenaría bien.
 */
@Component({
  selector: "app-workflow-list",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SkeletonComponent, SharedModule],
  templateUrl: "./workflow-list.component.html",
})
export class WorkflowListComponent implements OnInit {
  readonly workflows = signal<WorkflowSummary[]>([]);
  readonly cargando = signal(true);
  readonly mostrarFormulario = signal(false);

  /** Disparadores que el motor reconoce hoy. */
  /** Disparadores del catálogo del motor: la lista que manda es la del servidor. */
  readonly disparadores = signal<{ valor: string; titulo: string }[]>([
    { valor: "TICKET_CREATED", titulo: "Ticket creado" },
  ]);

  readonly modosProgramacion = MODOS_PROGRAMACION;
  /** Disparadores con icono y color, para app-master-select. */
  readonly opcDisparadores = computed<MasterOption[]>(() =>
    this.disparadores().map((d) => opcionDisparador(d.valor, d.titulo)),
  );

  /** Programación, solo para el disparador SCHEDULED. */
  programacion: ScheduleConfig = { modo: "INTERVALO", minutos: 60 };

  form: WorkflowCreateRequest = {
    name: "",
    description: "",
    triggerType: "TICKET_CREATED",
    triggerConfig: "{}",
  };

  constructor(
    private workflowService: WorkflowService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.workflowService.catalogo().subscribe({
      next: (c) =>
        this.disparadores.set(
          c.disparadores.map((d) => ({ valor: d.tipo, titulo: d.descripcion })),
        ),
      error: () => undefined,
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.workflowService.listar().subscribe({
      next: (lista) => {
        this.workflows.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.toast.error("No se pudieron cargar los workflows");
        this.cargando.set(false);
      },
    });
  }

  crear(): void {
    if (!this.form.name?.trim()) {
      this.toast.warn("Ponle un nombre al proceso");
      return;
    }
    this.workflowService
      .crear({
        name: this.form.name.trim(),
        description: this.form.description?.trim() || null,
        triggerType: this.form.triggerType,
        triggerConfig:
          this.form.triggerType === "SCHEDULED"
            ? JSON.stringify(this.programacionLimpia())
            : "{}",
      })
      .subscribe({
        next: (creado) => {
          this.toast.success(`"${creado.name}" creado. Ahora dibuja su grafo.`);
          this.mostrarFormulario.set(false);
          this.form = {
            name: "",
            description: "",
            triggerType: "TICKET_CREATED",
            triggerConfig: "{}",
          };
          this.router.navigate(["/workflows", creado.id, "editar"]);
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? "No se pudo crear el workflow"),
      });
  }

  activar(w: WorkflowSummary): void {
    this.workflowService.activar(w.id).subscribe({
      next: () => {
        this.toast.success(`"${w.name}" activado`);
        this.cargar();
      },
      error: (e) => this.toast.error(e?.error?.message ?? "No se pudo activar"),
    });
  }

  desactivar(w: WorkflowSummary): void {
    this.workflowService.desactivar(w.id).subscribe({
      next: () => {
        this.toast.info(`"${w.name}" desactivado`);
        this.cargar();
      },
      error: (e) =>
        this.toast.error(e?.error?.message ?? "No se pudo desactivar"),
    });
  }

  borrar(w: WorkflowSummary): void {
    void Swal.fire({
      title: `¿Eliminar "${w.name}"?`,
      html: `
        <p style="font-size:13px;color:#64748b;margin:0">
          Su historial de ejecuciones se conserva.
        </p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.workflowService.borrar(w.id).subscribe({
        next: () => {
          this.toast.info(`"${w.name}" eliminado`);
          this.cargar();
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? "No se pudo eliminar"),
      });
    });
  }

  /** Lanza una ejecución a mano, para probar el proceso sin esperar un evento. */
  ejecutar(w: WorkflowSummary): void {
    void Swal.fire({
      title: `Ejecutar "${w.name}" ahora`,
      html: `
        <p style="font-size:13px;color:#64748b;margin:0 0 12px 0">
          Número de ticket sobre el que actuar (vacío si no aplica).
        </p>
      `,
      input: "number",
      inputPlaceholder: "Ej. 1234",
      inputAttributes: {
        min: "1",
        step: "1",
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Ejecutar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#062e86",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      inputValidator: (v) => {
        // Vacío es válido: hay disparadores que no necesitan ticket.
        if (v === "" || v === null || v === undefined) return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          return "Indica un número de ticket válido (entero mayor que 0)";
        }
        return null;
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      const valor = String(r.value ?? "").trim();
      const id = Number(valor);
      const payload: Record<string, unknown> =
        valor && Number.isFinite(id) && id > 0 ? { ticketId: id } : {};
      this.workflowService.ejecutarAhora(w.id, payload).subscribe({
        next: (e) => {
          this.toast.success(
            "Ejecución encolada. Mírala en el historial.",
          );
          this.router.navigate(["/workflows", w.id, "ejecuciones"], {
            queryParams: { ver: e.id },
          });
        },
        error: (err) =>
          this.toast.error(
            err?.error?.message ?? "No se pudo encolar la ejecución",
          ),
      });
    });
  }

  irAlGrafo(w: WorkflowSummary): void {
    this.router.navigate(["/workflows", w.id, "editar"]);
  }

  irAlHistorial(w: WorkflowSummary): void {
    this.router.navigate(["/workflows", w.id, "ejecuciones"]);
  }

  claseEstado(w: WorkflowSummary): string {
    switch (w.status) {
      case "ACTIVO":
        return "badge-success text-success-content";
      case "BORRADOR":
        return "badge-ghost text-base-content/60";
      case "ERROR":
        return "badge-error text-error-content";
      default:
        return "badge-warning text-warning-content";
    }
  }

  /** Icono del badge de estado, con el mismo color que el badge. */
  iconoEstado(w: WorkflowSummary): string {
    switch (w.status) {
      case "ACTIVO":
        return "fa-solid fa-play";
      case "ERROR":
        return "fa-solid fa-circle-exclamation";
      case "BORRADOR":
        return "fa-regular fa-file-lines";
      default:
        return "fa-solid fa-pause";
    }
  }

  etiquetaDisparador(tipo: string): string {
    return this.disparadores().find((d) => d.valor === tipo)?.titulo ?? tipo;
  }

  private programacionLimpia(): ScheduleConfig {
    const p = this.programacion;
    if (p.modo === "INTERVALO")
      return { modo: "INTERVALO", minutos: Number(p.minutos) };
    if (p.modo === "CRON") return { modo: "CRON", cron: (p.cron ?? "").trim() };
    const f = (p.fecha ?? "").trim();
    return { modo: "FECHA", fecha: f.length === 16 ? `${f}:00-05:00` : f };
  }

  irAlHistorialGlobal(): void {
    this.router.navigate(["/workflows", "ejecuciones"]);
  }

  fecha(iso: string | null | undefined): string {
    return iso ? new Date(iso).toLocaleString("es-EC") : "—";
  }
}

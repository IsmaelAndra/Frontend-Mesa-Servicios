import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { WorkflowService } from "../../../core/services/workflow.service";
import { ToastService } from "../../../core/services/toast.service";
import { WorkflowApproval } from "../../../models/workflow.model";
import { AuthService } from "../../../core/services/auth.service";

/** Estado de una solicitud, para el badge de "Mis solicitudes". */
const ESTADOS_SOLICITUD: Record<string, { texto: string; icono: string; clase: string }> = {
  PENDING: { texto: "En espera", icono: "fa-solid fa-hourglass-half", clase: "badge-warning text-warning-content" },
  APPROVED: { texto: "Aprobada", icono: "fa-solid fa-circle-check", clase: "badge-success text-success-content" },
  REJECTED: { texto: "Rechazada", icono: "fa-solid fa-circle-xmark", clase: "badge-error text-error-content" },
  TIMEOUT: { texto: "Vencida", icono: "fa-regular fa-clock", clase: "badge-ghost text-base-content/70" },
};

/**
 * Bandeja de aprobaciones de las automatizaciones.
 *
 * <p>Solo para ADMIN y SUPER_ADMIN. El SUPER_ADMIN decide ("Por decidir"); el
 * ADMIN origina las solicitudes y espera a ver si se aceptaron ("Mis
 * solicitudes"). Ocultar botones aquí no protege nada: el backend vuelve a
 * comprobarlo al decidir.
 */
@Component({
  selector: "app-workflow-approvals",
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, RouterModule],
  templateUrl: "./workflow-approvals.component.html",
})
export class WorkflowApprovalsComponent implements OnInit {
  readonly pendientes = signal<WorkflowApproval[]>([]);
  readonly cargando = signal(true);
  readonly decidiendo = signal<string | null>(null);
  /** Tarjetas ya decididas que están saliendo (se animan antes de quitarlas). */
  readonly saliendo = signal<ReadonlySet<string>>(new Set());
  comentarios: Record<string, string> = {};
  /** Solo el SUPER_ADMIN decide. */
  readonly esAprobador: boolean;
  readonly vista = signal<"decidir" | "mias">("mias");
  readonly mias = signal<WorkflowApproval[]>([]);

  constructor(
    private workflowService: WorkflowService,
    private toast: ToastService,
    auth: AuthService,
  ) {
    this.esAprobador = auth.getRole() === "SUPER_ADMIN";
    if (this.esAprobador) {
      this.vista.set("decidir");
    }
  }

  ngOnInit(): void {
    this.cargar();
  }

  verVista(v: "decidir" | "mias"): void {
    if (v === "decidir" && !this.esAprobador) return;
    this.vista.set(v);
    this.cargar();
  }

  get pendientesMias(): number {
    return this.mias().filter((m) => (m.status ?? "PENDING") === "PENDING").length;
  }

  estado(a: WorkflowApproval) {
    return ESTADOS_SOLICITUD[a.status ?? "PENDING"] ?? ESTADOS_SOLICITUD["PENDING"];
  }

  cargar(): void {
    this.cargando.set(true);
    if (this.vista() === "mias") {
      this.workflowService.misSolicitudes().subscribe({
        next: (lista) => {
          this.mias.set(lista);
          this.cargando.set(false);
        },
        error: () => {
          this.toast.error("No se pudieron cargar sus solicitudes");
          this.cargando.set(false);
        },
      });
      return;
    }
    this.workflowService.aprobacionesPendientes().subscribe({
      next: (lista) => {
        this.pendientes.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.toast.error("No se pudieron cargar las aprobaciones");
        this.cargando.set(false);
      },
    });
  }

  decidir(a: WorkflowApproval, aprobar: boolean): void {
    const comentario = (this.comentarios[a.id] ?? "").trim();
    if (!aprobar && !comentario) {
      this.toast.warn("Indique el motivo del rechazo");
      return;
    }
    this.decidiendo.set(a.id);
    this.workflowService
      .decidirAprobacion(a.id, aprobar, comentario || null)
      .subscribe({
        next: () => {
          this.decidiendo.set(null);
          this.toast.success(
            aprobar ? "Aprobado: el proceso continúa" : "Rechazado",
          );
          // La tarjeta sale con una animación corta y después se quita: si
          // desapareciera de golpe, las de abajo saltarían sin explicación.
          this.saliendo.update((s) => new Set(s).add(a.id));
          setTimeout(() => {
            this.pendientes.update((l) => l.filter((x) => x.id !== a.id));
            this.saliendo.update((s) => {
              const n = new Set(s);
              n.delete(a.id);
              return n;
            });
          }, 260);
        },
        error: (e) => {
          this.decidiendo.set(null);
          this.toast.error(
            e?.error?.message ?? "No se pudo registrar la decisión",
          );
          this.cargar();
        },
      });
  }

  fecha(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString("es-EC") : "—";
  }

  /** Si la fecha limite cae dentro de las proximas 24 horas. */
  porVencer(a: WorkflowApproval): boolean {
    if (!a.deadline) return false;
    const falta = new Date(a.deadline).getTime() - Date.now();
    return falta > 0 && falta < 24 * 60 * 60 * 1000;
  }

  /** Texto humano para la fecha limite: "Vence en 3 h", "Vence en 2 dias", etc. */
  etiquetaPlazo(a: WorkflowApproval): string {
    if (!a.deadline) return "";
    const falta = new Date(a.deadline).getTime() - Date.now();
    if (falta <= 0) return "Vencida";
    const min = Math.round(falta / 60_000);
    if (min < 60) return `Vence en ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Vence en ${h} h`;
    const d = Math.round(h / 24);
    return `Vence en ${d} ${d === 1 ? "día" : "días"}`;
  }
}

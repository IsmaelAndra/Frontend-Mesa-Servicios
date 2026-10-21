import { Component, OnInit } from "@angular/core";
import Swal from "sweetalert2";
import * as moment from "moment";
import { AdminService } from "../../../core/services/admin.service";
import { Catalog } from "../../../models/user.model";
import { MonthlyEvaluation } from "../../../models/dashboard.model";
import { ToastService } from "../../../core/services/toast.service";
import { Paginacion } from "../../../core/utils/pagination.util";
import { duracionLegible } from "../../../core/utils/duracion.util";
import { urlDelApi } from '../../../core/utils/url-api.util';

@Component({
  selector: "app-sla-config",
  templateUrl: "./sla-config.component.html",
})
export class SlaConfigComponent implements OnInit {
  /** Plazos en texto legible ("1 d", "4 h") en vez de minutos crudos. */
  readonly duracion = duracionLegible;
  catalog?: Catalog;
  evaluations: MonthlyEvaluation[] = [];
  loadingEvals = false;

  /** Con un agente por fila no hacia falta, pero el listado crece con el padrón. */
  readonly pagEvals = new Paginacion<MonthlyEvaluation>(
    () => this.evaluations,
    10,
  );

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () =>
        this.toastService.error("No se pudo cargar la configuración SLA"),
    });
    this.loadEvaluations();
  }

  loadEvaluations(): void {
    const month = moment().startOf("month").format("YYYY-MM-DD");
    this.adminService.evaluationsByMonth(month).subscribe({
      next: (evs) => (this.evaluations = evs),
      error: () => undefined,
    });
  }

  generateEvaluations(): void {
    const month = moment().startOf("month").format("YYYY-MM-DD");
    const mesBonito = moment().locale("es").format("MMMM YYYY");

    Swal.fire({
      title: "Generar evaluaciones mensuales",
      html: `
      <p style="font-size:14px;">Se generará la evaluación de desempeño para <strong>${mesBonito}</strong>.</p>
      <p style="font-size:12px;opacity:0.7;margin-top:8px;">Si ya existen evaluaciones para este mes, se recalcularán con los datos actuales.</p>
    `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generar ahora",
      cancelButtonText: "Cancelar",
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.loadingEvals = true;
      this.adminService.generateEvaluations(month).subscribe({
        next: (evs) => {
          this.evaluations = evs;
          this.loadingEvals = false;
          this.toastService.success(`${evs.length} evaluaciones generadas`);
        },
        error: (e) => {
          this.loadingEvals = false;
          this.toastService.error(
            e?.error?.message || "No se pudieron generar",
          );
        },
      });
    });
  }

  // ============ Mes actual formateado ============
  get mesActual(): string {
    return moment()
      .locale("es")
      .format("MMMM YYYY")
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  // ============ KPIs resumen ============
  get totalTicketsCerrados(): number {
    return this.evaluations.reduce((sum, e) => sum + (e.ticketsClosed || 0), 0);
  }

  get promedioSla(): number {
    const validos = this.evaluations.filter((e) => e.slaComplianceRate != null);
    if (!validos.length) return 0;
    const suma = validos.reduce(
      (sum, e) => sum + (e.slaComplianceRate || 0),
      0,
    );
    return Math.round(suma / validos.length);
  }

  get promedioSatisfaccion(): string {
    const validos = this.evaluations.filter((e) => e.satisfactionScore != null);
    if (!validos.length) return "—";
    const suma = validos.reduce(
      (sum, e) => sum + (e.satisfactionScore || 0),
      0,
    );
    return (suma / validos.length).toFixed(1);
  }

  get evaluacionesRevisadas(): number {
    return this.evaluations.filter((e) => e.status === "REVIEWED").length;
  }

  // ============ Helpers de la tabla ============
  inicialAgente(email: string): string {
    return (email || "?").charAt(0).toUpperCase();
  }

  /**
   * Foto del agente evaluado. Las rutas del backend son relativas al contexto
   * `/api`, así que hay que prefijarlas; si ya vinieran absolutas se respetan.
   */
  agentPhoto(e: MonthlyEvaluation): string | null {
    const foto = (e.agentPhotoUrl || "").trim();
    if (!foto) return null;
    if (/^https?:\/\//i.test(foto)) return foto;
    return urlDelApi(foto);
  }

  /** Nombre del agente, cayendo al correo si el backend no lo manda. */
  agentLabel(e: MonthlyEvaluation): string {
    return e.agentDisplayName || e.agentEmail;
  }

  /**
   * Icono y color de una política SLA.
   *
   * El backend los manda desde la tabla `sla_policy`, donde se editan, pero no
   * los devolvía el catálogo: era la única entidad del catálogo sin icono ni
   * color, así que todas las políticas se pintaban con el mismo escudo. Cuando
   * una política no tiene icono configurado se usa el escudo como antes, para no
   * dejar el hueco vacío.
   */
  policyIcon(p: { icon?: string }): string {
    return (p.icon || "").trim() || "fa-solid fa-shield-halved";
  }

  policyColor(p: { color?: string }): string {
    return (p.color || "").trim() || "#062e86";
  }

  /** Fondo suave a partir del color de la política, para el chip del nombre. */
  policyBg(p: { color?: string }): string {
    return this.policyColor(p) + "1f";
  }

  slaBadgeClass(rate: number | null | undefined): string {
    if (rate == null) return "badge-ghost opacity-50";
    if (rate >= 90) return "badge-success text-success-content";
    if (rate >= 70) return "badge-warning text-warning-content";
    return "badge-error text-error-content";
  }

  slaBadgeIcon(rate: number | null | undefined): string {
    if (rate == null) return "fa-solid fa-minus";
    if (rate >= 90) return "fa-solid fa-circle-check";
    if (rate >= 70) return "fa-solid fa-triangle-exclamation";
    return "fa-solid fa-circle-xmark";
  }
}

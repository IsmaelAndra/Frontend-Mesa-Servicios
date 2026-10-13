import { Component, OnInit } from "@angular/core";
import { ORDEN_REPORTES, PERIODOS_REPORTE } from '../../core/utils/opciones-select.util';
import { saveAs } from "file-saver";
import { NotificationService } from "../../core/services/notification.service";
import { AdminService } from "../../core/services/admin.service";
import { ToastService } from "../../core/services/toast.service";
import { MasterOption } from "../shared/components/master-select/master-select.component";

interface ReportItem {
  kind: "custom";
  name: string;
  label: string;
  description?: string;
  id: string;
  icon?: string;
  color?: string;
}

@Component({
  selector: "app-reports",
  templateUrl: "./reports.component.html",
})
export class ReportsComponent implements OnInit {
  readonly periodos = PERIODOS_REPORTE;
  readonly ordenReportes = ORDEN_REPORTES;
  /** Los reportes los publica el backend; aquí no hay ninguna lista fija. */
  reports: ReportItem[] = [];

  format = "PDF";
  /** "H" hoja apaisada (más columnas) · "V" vertical. */
  orientacion: "H" | "V" = "H";
  period = "MES";
  fromDate = new Date().toISOString().slice(0, 10);
  toDate = new Date().toISOString().slice(0, 10);
  /** null = sin filtro. La opción vacía de app-master-select entrega null. */
typeId: string | null = null;
    /** Sede por la que se acota el reporte; null = todas. */
    sucursalId: string | null = null;
    ticketTypes: { id: string; name: string; icon?: string; color?: string }[] =
      [];
    sucursales: { id: string; code: string; name: string; icon?: string; color?: string }[] =
      [];

  /** Opciones del filtro de tipo, con icono y color del maestro. */
  get ticketTypeOptions(): MasterOption[] {
    return this.ticketTypes.map(t => ({
      value: t.id,
      label: t.name,
      icon: t.icon,
      color: t.color
    }));
  }

  /** Opciones del filtro de sede, con el icono y color de la oficina. */
  get sucursalOptions(): MasterOption[] {
    return this.sucursales.map(s => ({
      value: s.id,
      label: `${s.code} - ${s.name}`,
      icon: s.icon,
      color: s.color
    }));
  }

  /** Nombre de la sede para el chip de filtro activo. */
  sucursalName(id: string): string {
    const s = this.sucursales.find(x => x.id === id);
    return s ? `${s.code} - ${s.name}` : "";
  }

  // Estado de filtros
  search = "";
  sortBy: "label" | "label-desc" = "label";

  // Estado de descarga por reporte (usa el label como clave única)
  downloading: Record<string, boolean> = {};

  // Estado de "cargando" del botón Actualizar
  loading = false;

  constructor(
    private notificationService: NotificationService,
    private adminService: AdminService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.applyPeriod();
    this.adminService.catalog().subscribe({
      next: (c) => {
        this.ticketTypes = c.ticketTypes || [];
        this.sucursales = c.sucursales || [];
      },
      error: () => undefined,
    });
    this.loadCustomReports();
  }

  /** Carga los reportes que publica el backend (solo los activos). */
  loadCustomReports(): void {
    this.notificationService.availableReports().subscribe({
      next: (list) => {
        this.reports = (Array.isArray(list) ? list : []).map((r) => ({
          kind: "custom" as const,
          name: r.nombre,
          label: r.titulo,
          description: r.descripcion || "Reporte definido por consulta SQL",
          id: r.id,
          icon: r.icono || "fa-solid fa-file-lines",
          color: r.color || "#062e86",
        }));
      },
      error: () => {
        this.reports = [];
        this.toastService.error("No se pudieron cargar los reportes");
      },
    });
  }

  applyPeriod(): void {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    switch (this.period) {
      case "HOY":
        this.fromDate = iso(today);
        this.toDate = iso(today);
        break;
      case "MES":
        this.fromDate = iso(new Date(today.getFullYear(), today.getMonth(), 1));
        this.toDate = iso(today);
        break;
      case "ANIO":
        this.fromDate = iso(new Date(today.getFullYear(), 0, 1));
        this.toDate = iso(today);
        break;
      case "SEMESTRE":
        this.fromDate = iso(
          new Date(today.getFullYear(), today.getMonth() - 5, 1),
        );
        this.toDate = iso(today);
        break;
      case "PERSONALIZADO":
        break;
      default:
        this.fromDate = "";
        this.toDate = "";
    }
  }

  get filterParams(): {
    from?: string;
    to?: string;
    typeId?: string;
    sucursalId?: string;
  } {
    const params: { from?: string; to?: string; typeId?: string; sucursalId?: string } = {};
    if (this.period !== "TODO") {
      if (this.fromDate) params.from = this.fromDate;
      if (this.toDate) params.to = this.toDate;
    }
    if (this.typeId) params.typeId = this.typeId;
    if (this.sucursalId) params.sucursalId = this.sucursalId;
    return params;
  }

  /** Lista filtrada y ordenada según los controles de la barra de filtros */
  get filteredReports(): ReportItem[] {
    let result = [...this.reports];

    // Filtro por búsqueda
    const term = this.search?.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (r) =>
          r.label.toLowerCase().includes(term) ||
          r.name.toLowerCase().includes(term),
      );
    }

    // Ordenamiento
    result.sort((a, b) => {
      const cmp = a.label.localeCompare(b.label, "es");
      return this.sortBy === "label-desc" ? -cmp : cmp;
    });

    return result;
  }

  /** Color del reporte; el fondo del icono usa el mismo color con 13% de opacidad. */
  reportColor(r: ReportItem): string {
    return r.color || "#062e86";
  }

  /** Botón "Actualizar" */
  loadReports(): void {
    if (this.loading) return;
    this.loading = true;
    this.loadCustomReports();
    this.adminService.catalog().subscribe({
      next: (c) => {
        this.ticketTypes = c.ticketTypes || [];
        this.sucursales = c.sucursales || [];
      },
      error: () => undefined,
    });
    setTimeout(() => {
      this.loading = false;
      this.lastRefresh = new Date();
      this.toastService.success("Reportes actualizados");
    }, 500);
  }

  /** Descarga un reporte mostrando spinner en su propia tarjeta */
  download(r: ReportItem): void {
    if (this.downloading[r.label]) return;
    this.downloading[r.label] = true;

    const request = this.notificationService.downloadReport(
      r.id,
      this.format,
      { ...this.filterParams, orientacion: this.orientacion },
    );

    request.subscribe({
      next: (blob) => {
        const ext =
          this.format === "EXCEL" ? "xlsx" : this.format.toLowerCase();
        const date = new Date().toISOString().slice(0, 10);
        saveAs(blob, `${r.name}_${date}.${ext}`);

        this.toastService.success(`${r.label} generado`);
        this.downloading[r.label] = false;
      },
      error: (err) => {
        this.toastService.error(
          err?.error?.message || "No se pudo generar el reporte",
        );
        this.downloading[r.label] = false;
      },
    });
  }

  formats = [
    { value: "PDF", label: "PDF", icon: "fa-regular fa-file-pdf" },
    { value: "EXCEL", label: "Excel", icon: "fa-regular fa-file-excel" },
    { value: "HTML", label: "HTML", icon: "fa-solid fa-globe" },
  ] as const;

  lastRefresh: Date | null = null;

  // Añade estos métodos:
  trackByLabel(_: number, r: ReportItem): string {
    return r.label;
  }

  get hasActiveFilters(): boolean {
    return !!(this.search || this.period !== "MES" || this.typeId || this.sucursalId);
  }

  typeName(id?: string): string {
    if (!id) return "";
    return this.ticketTypes.find((t) => t.id === id)?.name ?? "";
  }

  periodLabel(): string {
    switch (this.period) {
      case "HOY":
        return "Hoy";
      case "MES":
        return "Este mes";
      case "ANIO":
        return "Este año";
      case "SEMESTRE":
        return "Últimos 6 meses";
      case "PERSONALIZADO":
        return "Rango personalizado";
      case "TODO":
        return "Todo";
      default:
        return this.period;
    }
  }

  clearFilters(): void {
    this.search = "";
    this.period = "MES";
    this.applyPeriod();
    this.typeId = null;
    this.sucursalId = null;
    this.sortBy = "label";
  }
}

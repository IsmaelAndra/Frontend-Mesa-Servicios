import { Component, OnInit } from "@angular/core";
import { AdminService } from "../../../core/services/admin.service";
import { AuthService } from "../../../core/services/auth.service";
import { ToastService } from "../../../core/services/toast.service";
import { Catalog } from "../../../models/user.model";
import { duracionLegible } from '../../../core/utils/duracion.util';

@Component({
  selector: "app-admin-dashboard",
  templateUrl: "./admin-dashboard.component.html",
})
export class AdminDashboardComponent implements OnInit {
  catalog?: Catalog;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private toastService: ToastService,
  ) {}

  get isSuperAdmin(): boolean {
    return this.authService.getRole() === "SUPER_ADMIN";
  }

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => this.toastService.error("No se pudo cargar el catálogo"),
    });
  }

  // ============ ÁREAS ============
  getActiveAreasCount(): number {
    return this.catalog?.areas?.filter((a) => a.status).length ?? 0;
  }

  getInactiveAreasCount(): number {
    return this.catalog?.areas?.filter((a) => !a.status).length ?? 0;
  }

  getActiveAreasPercent(): number {
    const total = this.catalog?.areas?.length ?? 0;
    if (!total) return 0;
    return Math.round((this.getActiveAreasCount() / total) * 100);
  }

  /** Devuelve cuántas áreas hay en cada rango de prioridad. */
  getPriorityDistribution(): { high: number; medium: number; low: number } {
    const areas = this.catalog?.areas ?? [];
    return {
      high: areas.filter((a) => a.priorityLevel >= 8).length,
      medium: areas.filter((a) => a.priorityLevel >= 5 && a.priorityLevel < 8)
        .length,
      low: areas.filter((a) => a.priorityLevel < 5).length,
    };
  }

  // ============ SLA ============
  /** Promedio de minutos de respuesta de todas las políticas SLA. */
  getAvgResponse(): number {
    const list = this.catalog?.slaPolicies ?? [];
    if (!list.length) return 0;
    const sum = list.reduce((acc, s) => acc + (s.response || 0), 0);
    return Math.round(sum / list.length);
  }

  /** Promedio de minutos de resolución de todas las políticas SLA. */
  getAvgResolution(): number {
    const list = this.catalog?.slaPolicies ?? [];
    if (!list.length) return 0;
    const sum = list.reduce((acc, s) => acc + (s.resolution || 0), 0);
    return Math.round(sum / list.length);
  }

  /** Formatea minutos a un texto legible (ej: 90 → "1 h 30 min"). */
  formatMinutes(min: number): string {
    return duracionLegible(min);
  }

  // ============ CATEGORÍAS ============
  getCategoriesCount(): number {
    return this.catalog?.categories?.length ?? 0;
  }
}

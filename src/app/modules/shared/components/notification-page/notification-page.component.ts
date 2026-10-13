import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import Swal from "sweetalert2";
import { NotificationService } from "src/app/core/services/notification.service";
import { Notification } from "src/app/models/notification.model";
import { ToastService } from "src/app/core/services/toast.service";
import {
  notificationColor,
  notificationIcon,
  notificationLabel,
  notificationTarget,
} from "src/app/core/constants/notification-presentation";
import { SharedModule } from "src/app/modules/shared/shared.module";

@Component({
  selector: "app-notification-page",
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: "./notification-page.component.html",
  styleUrls: ["./notification-page.component.css"],
})
export class NotificationPageComponent implements OnInit {
  // Lista completa (para filtrar y paginar sin perder datos)
  private allNotifications: Notification[] = [];

  // Lista visible (filtrada + paginada)
  notifications: Notification[] = [];

  pageSize = 8;
  currentPage = 1;
  totalPages = 1;
  statusFilter: "LEIDA" | "NO_LEIDA" | "ALL" = "ALL";

  isLoading = false;

  // El icono y el color salen del mapa compartido con el navbar, para que la
  // misma notificación se vea igual en el desplegable y en esta pagina.
  readonly notificationIcon = notificationIcon;
  readonly notificationColor = notificationColor;
  readonly notificationLabel = notificationLabel;

  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    this.loadNotifications();
  }

  /** Carga todas las notificaciones del backend (una sola vez) */
  private loadNotifications(): void {
    this.isLoading = true;
    this.notificationService.myNotifications().subscribe({
      next: (list: Notification[]) => {
        this.allNotifications = list || [];
        this.currentPage = 1; // reset a la primera página al recargar
        this.applyFilterAndPagination();
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        console.error("Error cargando notificaciones", err);
        this.allNotifications = [];
        this.notifications = [];
        this.totalPages = 1;
        this.currentPage = 1;
        this.isLoading = false;
        this.toastService.error("No se pudieron cargar las notificaciones");
      },
    });
  }

  /** Cambia el filtro y vuelve a la primera página */
  filterByStatus(): void {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilterAndPagination();
    }
  }

  goToPage(page: number): void {
    // El paginador emite base 0, el componente usa base 1
    const p = page + 1;
    if (p < 1 || p > this.totalPages || p === this.currentPage) return;
    this.currentPage = p;
    this.applyFilterAndPagination();
  }

  /** ¿Hay alguna notificación no leída en toda la lista? */
  get hasUnread(): boolean {
    return this.allNotifications.some((n) => !n.readNotification);
  }

  /** Click en una notificación: la marca como leída y navega a su destino. */
  openNotification(notif: Notification): void {
    if (!notif.readNotification) {
      this.notificationService.markAsRead(notif.idNotification).subscribe({
        next: () => {
          notif.readNotification = true;
          notif.readAtNotification = new Date().toISOString();
          this.applyFilterAndPagination();
          // Para que el contador del navbar no siga mostrando la notification
          // como pendiente.
          this.notificationService.notificarLectura();
        },
        error: () => undefined,
      });
    }
    const destino = notificationTarget(notif);
    if (destino) {
      this.router.navigate(destino);
    } else {
      // Sin ticket y sin destino conocido: antes no pasaba nada y parecía un clic
      // roto, así que al menos se explica por qué.
      this.toastService.info(
        "Esta notificación no tiene una pantalla asociada. Ya está marcada como leída."
      );
    }
  }

  /** Marca todas como leídas en el backend */
  markAllAsRead(): void {
    if (!this.hasUnread) return;

    Swal.fire({
      title: "¿Marcar todas como leídas?",
      text: "Todas las notificaciones no leídas se marcarán como leídas.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, marcar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.isLoading = true;
      this.notificationService.markAllAsRead().subscribe({
        next: () => {
          const ahora = new Date().toISOString();
          this.allNotifications.forEach((n) => {
            if (!n.readNotification) {
              n.readNotification = true;
              n.readAtNotification = ahora;
            }
          });
          this.applyFilterAndPagination();
          this.isLoading = false;
          // El navbar lleva su propia copia y su propio contador.
          this.notificationService.notificarLectura();
          this.toastService.success("Notificaciones marcadas como leídas");
        },
        error: (err) => {
          this.isLoading = false;
          Swal.fire(
            "Error",
            err?.error?.message || "No se pudo completar la acción",
            "error",
          );
        },
      });
    });
  }

  // ============ Filtros nuevos ============
  searchText = "";
  typeFilter: string = "ALL";

  /** Tipos disponibles para el filtro (basados en los que tiene el usuario). */
  get tiposDisponibles(): string[] {
    const set = new Set<string>();
    this.allNotifications.forEach((n) => {
      if (n.typeNotification) set.add(n.typeNotification);
    });
    return Array.from(set).sort();
  }

  /** ¿Hay algún filtro activo? */
  get hasActiveFilters(): boolean {
    return (
      !!this.searchText ||
      this.statusFilter !== "ALL" ||
      this.typeFilter !== "ALL"
    );
  }

  /** Contador de no leídas (para el header). */
  get unreadCount(): number {
    return this.allNotifications.filter((n) => !n.readNotification).length;
  }

  /** Cantidad de notificaciones que pasan el filtro actual. */
  get filteredCount(): number {
    return this.filteredList.length;
  }

  // ============ Lista filtrada como getter reutilizable ============
  private get filteredList(): Notification[] {
    const term = this.searchText?.toLowerCase().trim() ?? "";
    return this.allNotifications.filter((n) => {
      // Estado
      if (this.statusFilter === "LEIDA" && !n.readNotification) return false;
      if (this.statusFilter === "NO_LEIDA" && n.readNotification) return false;

      // Tipo
      if (this.typeFilter !== "ALL" && n.typeNotification !== this.typeFilter)
        return false;

      // Búsqueda
      if (term) {
        const enAsunto = (n.subjectNotification || "")
          .toLowerCase()
          .includes(term);
        const enMensaje = (n.messageNotification || "")
          .toLowerCase()
          .includes(term);
        if (!enAsunto && !enMensaje) return false;
      }

      return true;
    });
  }

  // ============ applyFilterAndPagination actualizado ============
  private applyFilterAndPagination(): void {
    const filtered = this.filteredList;

    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.notifications = filtered.slice(start, end);
    this.grupos = this.agrupar();
    this.calcularResumen();
  }

  // ============ Limpiar filtros ============
  clearFilters(): void {
    this.searchText = "";
    this.statusFilter = "ALL";
    this.typeFilter = "ALL";
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  // ============ Cambiar tamaño de página ============
  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  // ============ Resumen y panel lateral ============
  /**
   * Se calculan al filtrar o paginar, no en getters: la barra superior fuerza
   * detección de cambios cada segundo y una lista recreada en cada vuelta hacía
   * que un clic cayera entre dos renderizados y se perdiera.
   */
  grupos: { label: string; items: Notification[] }[] = [];
  resumen = { total: 0, sinLeer: 0, leidas: 0, hoy: 0 };
  tiposConteo: { tipo: string; n: number }[] = [];

  setEstado(estado: "LEIDA" | "NO_LEIDA" | "ALL"): void {
    this.statusFilter = estado;
    this.filterByStatus();
  }

  setTipo(tipo: string): void {
    this.typeFilter = this.typeFilter === tipo ? "ALL" : tipo;
    this.filterByStatus();
  }

  /** Canal de color daisyUI del tipo (para fondo tenue y texto). */
  tonoTipo(tipo?: string): string {
    const clase = notificationColor(tipo);
    const mapa: Record<string, string> = {
      // El azul de marca casi no se ve sobre el fondo oscuro: se usa info.
      "bg-primary": "--in",
      "bg-success": "--su",
      "bg-info": "--in",
      "bg-error": "--er",
      "bg-warning": "--wa",
      "bg-secondary": "--s",
    };
    return mapa[clase] ?? "--bc";
  }

  trackNotif(_: number, n: Notification): string {
    return n.idNotification;
  }

  trackTipo(_: number, t: { tipo: string }): string {
    return t.tipo;
  }

  trackGrupo(_: number, g: { label: string }): string {
    return g.label;
  }

  private calcularResumen(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const sinLeer = this.allNotifications.filter((n) => !n.readNotification).length;
    this.resumen = {
      total: this.allNotifications.length,
      sinLeer,
      leidas: this.allNotifications.length - sinLeer,
      hoy: this.allNotifications.filter((n) => new Date(n.createdAtNotification).getTime() >= hoy.getTime()).length,
    };
    const conteo = new Map<string, number>();
    this.allNotifications.forEach((n) => {
      if (n.typeNotification) conteo.set(n.typeNotification, (conteo.get(n.typeNotification) ?? 0) + 1);
    });
    this.tiposConteo = Array.from(conteo.entries())
      .map(([tipo, n]) => ({ tipo, n }))
      .sort((a, b) => b.n - a.n);
  }

  // ============ Agrupar por fecha ============
  get groupedNotifications(): { label: string; items: Notification[] }[] {
    return this.grupos;
  }

  private agrupar(): { label: string; items: Notification[] }[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - 7);

    const grupos: Record<string, Notification[]> = {
      Hoy: [],
      Ayer: [],
      "Últimos 7 días": [],
      Anteriores: [],
    };

    // Importante: agrupar solo los VISIBLES en la página actual
    this.notifications.forEach((n) => {
      const fecha = new Date(n.createdAtNotification);
      fecha.setHours(0, 0, 0, 0);

      if (fecha.getTime() >= hoy.getTime()) {
        grupos["Hoy"].push(n);
      } else if (fecha.getTime() >= ayer.getTime()) {
        grupos["Ayer"].push(n);
      } else if (fecha.getTime() >= inicioSemana.getTime()) {
        grupos["Últimos 7 días"].push(n);
      } else {
        grupos["Anteriores"].push(n);
      }
    });

    return Object.entries(grupos)
      .filter(([_, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }

  // ============ Helpers de correo (badge compacto) ============
  correoBadgeClass(status: string): string {
    switch (status) {
      case "SENT":
        return "badge-soft badge-success";
      case "FAILED":
        return "badge-soft badge-error";
      default:
        return "badge-soft";
    }
  }

  correoBadgeIcon(status: string): string {
    switch (status) {
      case "SENT":
        return "fa-solid fa-paper-plane";
      case "FAILED":
        return "fa-solid fa-circle-exclamation";
      default:
        return "fa-solid fa-clock";
    }
  }

  correoLabel(status: string): string {
    switch (status) {
      case "SENT":
        return "Enviado";
      case "FAILED":
        return "Fallido";
      default:
        return "Pendiente";
    }
  }
}

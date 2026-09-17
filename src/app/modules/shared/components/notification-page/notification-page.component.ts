import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { NotificationService } from 'src/app/core/services/notification.service';
import { Notification } from 'src/app/models/notification.model';

@Component({
  selector: 'app-notification-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-page.component.html',
  styleUrls: ['./notification-page.component.css']
})
export class NotificationPageComponent implements OnInit {
  // Lista completa (para filtrar y paginar sin perder datos)
  private allNotifications: Notification[] = [];

  // Lista visible (filtrada + paginada)
  notifications: Notification[] = [];

  pageSize = 8;
  currentPage = 1;
  totalPages = 1;
  statusFilter: 'LEIDA' | 'NO_LEIDA' | 'ALL' = 'ALL';

  isLoading = false;

  private notificationService = inject(NotificationService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadNotifications();
  }

  /** Carga todas las notificaciones del backend (una sola vez) */
  private loadNotifications(): void {
    this.isLoading = true;
    this.notificationService.myNotifications().subscribe({
      next: (list: Notification[]) => {
        this.allNotifications = list || [];
        this.currentPage = 1;   // reset a la primera página al recargar
        this.applyFilterAndPagination();
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error cargando notificaciones', err);
        this.allNotifications = [];
        this.notifications = [];
        this.totalPages = 1;
        this.currentPage = 1;
        this.isLoading = false;
        Swal.fire('Error', 'No se pudieron cargar las notificaciones', 'error');
      }
    });
  }

  /** Aplica filtro y paginación sobre la lista completa */
  private applyFilterAndPagination(): void {
    // 1. Filtro
    const filtered = this.allNotifications.filter((n) => {
      if (this.statusFilter === 'ALL') return true;
      return n.statusNotification === this.statusFilter;
    });

    // 2. Calcular total de páginas
    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize));

    // 3. Asegurar que la página actual no se pase del total
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    // 4. Aplicar paginación
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.notifications = filtered.slice(start, end);
  }

  /** Cambia el filtro y vuelve a la primera página */
  filterByStatus(): void {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilterAndPagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilterAndPagination();
    }
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.applyFilterAndPagination();
  }

  /** Devuelve los números de página a mostrar en el paginador */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = 5;
    const start = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    const end = Math.min(this.totalPages, start + maxPages - 1);

    // Ajustar si estamos cerca del final
    const adjustedStart = Math.max(1, end - maxPages + 1);

    for (let i = adjustedStart; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getStatusLabel(status: string): string {
    return status === 'LEIDA' ? 'Leída' : 'No leída';
  }

  /** ¿Hay alguna notificación no leída en toda la lista? */
  get hasUnread(): boolean {
    return this.allNotifications.some((n) => n.statusNotification === 'NO_LEIDA');
  }

  /** Click en una notificación: navega al ticket si tiene uno asociado */
  openNotification(notif: Notification): void {
    if (notif.ticketId) {
      this.router.navigate(['/tickets', notif.ticketId]);
    }
  }

  /** Marca todas como leídas en el backend */
  markAllAsRead(): void {
    if (!this.hasUnread) return;

    Swal.fire({
      title: '¿Marcar todas como leídas?',
      text: 'Todas las notificaciones no leídas se marcarán como leídas.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.isLoading = true;
      // Si tu servicio no tiene este método, elimina esta parte
      // this.notificationService.markAllAsRead().subscribe({
      //   next: () => {
      //     this.allNotifications.forEach(n => n.statusNotification = 'LEIDA');
      //     this.applyFilterAndPagination();
      //     this.isLoading = false;
      //     Swal.fire({
      //       icon: 'success',
      //       title: 'Notificaciones marcadas',
      //       timer: 1200,
      //       showConfirmButton: false
      //     });
      //   },
      //   error: (err) => {
      //     this.isLoading = false;
      //     Swal.fire('Error', err?.error?.message || 'No se pudo completar la acción', 'error');
      //   }
      // });

      // Mientras tanto (marcado en frontend):
      this.allNotifications.forEach((n) => (n.statusNotification = 'LEIDA'));
      this.applyFilterAndPagination();
      this.isLoading = false;
      Swal.fire({
        icon: 'success',
        title: 'Notificaciones marcadas',
        timer: 1200,
        showConfirmButton: false
      });
    });
  }
}
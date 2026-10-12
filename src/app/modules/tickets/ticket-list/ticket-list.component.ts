import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TicketService } from '../../../core/services/ticket.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Catalog } from '../../../models/user.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { Ticket } from '../../../models/ticket.model';

@Component({
  selector: 'app-ticket-list',
  templateUrl: './ticket-list.component.html'
})
export class TicketListComponent implements OnInit {
  tickets: Ticket[] = [];
  loading = true;
  keyword = '';
  status = '';
  role = '';
  mode: 'all' | 'mine' | 'assigned' = 'all';

  page = 0;
  pageSize = 10;

  statuses = ['NUEVO', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CERRADO', 'REABIERTO', 'ESCALADO'];

  /** Sede por la que filtrar; vacio significa "todas". */
  sucursalId: string | null = null;

  catalog: Catalog | null = null;

  /** Sede elegida en el filtro, para mostrar su icono y color en la columna. */
  sucursalFiltro(): { icon?: string; color?: string } | undefined {
    return this.catalog?.sucursales?.find((s) => s.id === this.sucursalId);
  }

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {
    this.role = this.authService.getRole();
    if (this.route.snapshot.data['mine']) this.mode = 'mine';
    else if (this.route.snapshot.data['assigned']) this.mode = 'assigned';
    // La búsqueda global llega con el término ya aplicado (?keyword=...).
    const kwParam = this.route.snapshot.queryParams?.['keyword'];
    if (kwParam) this.keyword = kwParam;
  }

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => undefined
    });
    if (this.role !== 'USER') {
      this.router.navigate(['/tickets/kanban'], { replaceUrl: true });
      return;
    }
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading = true;

    const effectiveMode: 'all' | 'mine' | 'assigned' = this.mode === 'all'
      ? (this.role === 'USER' ? 'mine' : this.role === 'AGENT' ? 'assigned' : 'all')
      : this.mode;

    if (effectiveMode === 'mine') {
      this.ticketService.myTickets().subscribe({
        next: (list) => {
          this.tickets = this.filterClient(list);
          this.page = 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.toastService.error('No se pudieron cargar tus tickets');
        }
      });
    } else if (effectiveMode === 'assigned') {
      this.ticketService.assigned().subscribe({
        next: (list) => {
          this.tickets = this.filterClient(list);
          this.page = 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.toastService.error('No se pudieron cargar los tickets asignados');
        }
      });
    } else {
      this.ticketService.search({ page: 0, size: 100, keyword: this.keyword, status: this.status, sucursalId: this.sucursalId ?? undefined })
        .subscribe({
          next: (p) => {
            this.tickets = p.content;
            this.page = 0;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.toastService.error('No se pudieron cargar los tickets');
          }
        });
    }
  }

  private filterClient(list: Ticket[]): Ticket[] {
    const kw = this.keyword?.trim().toLowerCase() || '';
    return list.filter((t) => {
      const matchKw = !kw
        || t.titleTicket?.toLowerCase().includes(kw)
        || String(t.idTicket).includes(kw);
const matchStatus = !this.status || t.status === this.status;
        const matchSucursal = !this.sucursalId || t.sucursalId === this.sucursalId;
        return matchKw && matchStatus && matchSucursal;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.tickets.length / this.pageSize));
  }

  get pagedTickets(): Ticket[] {
    const start = this.page * this.pageSize;
    return this.tickets.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.page + 1;
    let from = Math.max(1, current - 2);
    const to = Math.min(total, from + 4);
    from = Math.max(1, to - 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }

  /** Hay algún filtro aplicado: el vacío no significa "no hay tickets". */
  get hayFiltros(): boolean {
    return !!this.keyword?.trim() || !!this.status || this.sucursalId !== null;
  }

  limpiarFiltros(): void {
    this.keyword = '';
    this.status = '';
    this.sucursalId = null;
    this.loadTickets();
  }

  goToPage(p: number): void {
    this.page = Math.min(Math.max(0, p), this.totalPages - 1);
  }

  get canManage(): boolean {
    return this.role === 'ADMIN' || this.role === 'AGENT';
  }

  get isUser(): boolean {
    return this.role === 'USER';
  }

  get isAgent(): boolean {
    return this.role === 'AGENT';
  }

  color(priority: string): string {
    const map: Record<string, string> = {
      BAJA: 'badge-success',
      MEDIA: 'badge-info',
      ALTA: 'badge-warning',
      CRITICA: 'badge-error'
    };
    return map[priority] || 'badge-neutral';
  }

  /** Opciones del filtro de estado, con el icono y color del maestro. */
  get statusOptions(): MasterOption[] {
    return this.statuses.map(name => {
      const meta = this.statusMeta(name);
      return { value: name, label: name, icon: meta.icon, color: meta.color };
    });
  }

  areaMeta(name: string): { icon: string; color: string } {
    const a = this.catalog?.areas?.find((x) => x.name === name);
    return { icon: a?.icon || 'fa-solid fa-building', color: a?.color || '#062e86' };
  }

  /** Opciones del filtro de sede, con el icono y color del maestro. */
  get sucursalOptions(): MasterOption[] {
    return (this.catalog?.sucursales || []).map((s) => ({
      value: s.id,
      label: `${s.code} - ${s.name}`,
      icon: s.icon,
      color: s.color
    }));
  }

  /** Icono y color de la sede de un ticket, para la columna de la lista. */
  sucursalMeta(t: Ticket): { icon: string; color: string } {
    const s = this.catalog?.sucursales?.find((x) => x.id === t.sucursalId);
    return { icon: s?.icon || 'fa-solid fa-city', color: s?.color || '#94a3b8' };
  }

  statusMeta(name: string): { icon: string; color: string } {
    const s = this.catalog?.statuses?.find((x) => x.name === name);
    return { icon: s?.icon || '', color: s?.color || '' };
  }

  priorityMeta(name: string): { icon: string; color: string } {
    const p = this.catalog?.priorities?.find((x) => x.name === name);
    return { icon: p?.icon || '', color: p?.color || '' };
  }

  categoryMeta(name: string): { icon: string; color: string } {
    const c = this.catalog?.categories?.find((x) => x.name === name);
    return { icon: c?.icon || 'fa-solid fa-tag', color: c?.color || '#0891b2' };
  }
}
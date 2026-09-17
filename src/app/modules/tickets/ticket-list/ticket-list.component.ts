import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { TicketService } from '../../../core/services/ticket.service';
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

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.role = this.authService.getRole();
    if (this.route.snapshot.data['mine']) this.mode = 'mine';
    else if (this.route.snapshot.data['assigned']) this.mode = 'assigned';
  }

  ngOnInit(): void {
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
          Swal.fire('Error', 'No se pudieron cargar tus tickets', 'error');
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
          Swal.fire('Error', 'No se pudieron cargar los tickets asignados', 'error');
        }
      });
    } else {
      this.ticketService.search({ page: 0, size: 100, keyword: this.keyword, status: this.status })
        .subscribe({
          next: (p) => {
            this.tickets = p.content;
            this.page = 0;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudieron cargar los tickets', 'error');
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
      return matchKw && matchStatus;
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
    let to = Math.min(total, from + 4);
    from = Math.max(1, to - 4);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
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
}
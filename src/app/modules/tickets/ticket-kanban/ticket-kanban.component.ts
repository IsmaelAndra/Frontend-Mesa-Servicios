import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Ticket } from '../../../models/ticket.model';

interface TicketColumn {
  key: string;
  label: string;
  color: string;
  tickets: Ticket[];
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    NUEVO: '#3B82F6',
    ASIGNADO: '#8B5CF6',
    EN_PROCESO: '#F59E0B',
    RESUELTO: '#10B981',
    CERRADO: '#6B7280',
    ESCALADO: '#EF4444'
  };
  return map[status] || '#6B7280';
}

@Component({
  selector: 'app-ticket-kanban',
  templateUrl: './ticket-kanban.component.html',
  styleUrls: ['./ticket-kanban.component.css']
})
export class TicketKanbanComponent implements OnInit {
  columns: TicketColumn[] = [];
  loading = true;
  dragging = false;
  role = '';

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getRole();
    const statuses = ['NUEVO', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CERRADO', 'ESCALADO'];
    this.columns = statuses.map((s) => ({
      key: s,
      label: s.replace('_', ' '),
      color: statusColor(s),
      tickets: []
    }));
    this.load();
  }

  get columnIds(): string[] {
    return this.columns.map((c) => c.key);
  }

  get canManage(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPER_ADMIN' || this.role === 'AGENT';
  }

  load(): void {
    this.loading = true;
    if (this.role === 'AGENT') {
      this.ticketService.assigned().subscribe({
        next: (list) => this.populate(list),
        error: () => this.fail()
      });
    } else {
      this.ticketService.search({ size: 500 }).subscribe({
        next: (page) => this.populate(page.content),
        error: () => this.fail()
      });
    }
  }

  private populate(tickets: Ticket[] | undefined): void {
    this.columns.forEach((c) => (c.tickets = []));
    (tickets || []).forEach((t) => {
      const col = this.columns.find((c) => c.key === t.status);
      if (col) col.tickets.push(t);
    });
    this.loading = false;
  }

  private fail(): void {
    this.loading = false;
    Swal.fire('Error', 'No se pudieron cargar los tickets', 'error');
  }

  openTicket(id: number): void {
    if (this.dragging) return;
    this.router.navigate(['/tickets', id]);
  }

  onDragStart(): void {
    this.dragging = true;
  }

  onDragEnd(): void {
    setTimeout(() => (this.dragging = false), 120);
  }

  drop(event: CdkDragDrop<Ticket[]>): void {
    const to = this.columns.find((c) => c.tickets === event.container.data)!;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const ticket = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.ticketService.changeStatus(ticket.idTicket, to.key).subscribe({
      next: () => {
        ticket.status = to.key;
        Swal.fire({
          icon: 'success',
          title: `Movido a ${to.label}`,
          timer: 800,
          showConfirmButton: false
        });
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.message || 'No se pudo actualizar el estado', 'error');
        this.load();
      }
    });
  }
}
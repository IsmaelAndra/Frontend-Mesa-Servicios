import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  SessionState,
  metaSesion,
  normalizarSesion
} from '../../../core/utils/session-presence.util';
import { Ticket } from '../../../models/ticket.model';
import { Catalog } from '../../../models/user.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { environment } from '../../../../environments/environment';

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
  allTickets: Ticket[] = [];

  /** true si el tablero no pudo mostrar todos los tickets del backend. */
  truncado = false;
  catalog?: Catalog;
  loading = true;
  dragging = false;
  role = '';
  currentUserEmail = '';
  savingIds = new Set<string>();

  filterKeyword = '';
  filterPriority = '';
  filterCategory = '';
  filterArea = '';
  filterOnlyMine = false;

  readonly priorities = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getRole();
    this.currentUserEmail = this.authService.getEmail();
    const statuses = ['NUEVO', 'ASIGNADO', 'EN_PROCESO', 'RESUELTO', 'CERRADO', 'ESCALADO'];
    this.columns = statuses.map((s) => ({
      key: s,
      label: s.replace('_', ' '),
      color: statusColor(s),
      tickets: []
    }));
    this.loadCatalog();
    this.load();
  }

  private loadCatalog(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => undefined
    });
  }

  get columnIds(): string[] {
    return this.columns.map((c) => c.key);
  }

  get canManage(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPER_ADMIN' || this.role === 'AGENT';
  }

  get categories(): { id: string; name: string; icon?: string; color?: string }[] {
    return this.catalog?.categories || [];
  }

  get areas(): { id: string; name: string; icon?: string; color?: string }[] {
    return this.catalog?.areas || [];
  }

  /**
   * Opciones de los filtros del tablero. El valor sigue siendo el nombre (lo
   * que espera applyFilters), pero cada fila ya puede pintarse con el icono y
   * el color del maestro del catálogo.
   */
  get priorityOptions(): MasterOption[] {
    return this.priorities.map(name => {
      const meta = this.priorityMeta(name);
      return { value: name, label: name, icon: meta.icon, color: meta.color };
    });
  }

  get categoryOptions(): MasterOption[] {
    return this.categories.map(c => ({
      value: c.name,
      label: c.name,
      icon: c.icon,
      color: c.color
    }));
  }

  get areaOptions(): MasterOption[] {
    return this.areas.map(a => ({
      value: a.name,
      label: a.name,
      icon: a.icon,
      color: a.color
    }));
  }

  areaMeta(name: string): { icon: string; color: string } {
    const a = this.catalog?.areas?.find((x) => x.name === name);
    return { icon: a?.icon || '', color: a?.color || '#062e86' };
  }

  categoryMeta(name: string): { icon: string; color: string } {
    const c = this.catalog?.categories?.find((x) => x.name === name);
    return { icon: c?.icon || '', color: c?.color || '#0891b2' };
  }

  priorityMeta(name: string): { icon: string; color: string } {
    const p = this.catalog?.priorities?.find((x) => x.name === name);
    return { icon: p?.icon || '', color: p?.color || '' };
  }

  typeMeta(name: string): { icon: string; color: string } {
    const t = this.catalog?.ticketTypes?.find((x) => x.name === name);
    return { icon: t?.icon || '', color: t?.color || '' };
  }

  get totalCount(): number {
    return this.allTickets.length;
  }

  get filteredCount(): number {
    return this.columns.reduce((sum, c) => sum + c.tickets.length, 0);
  }

  get hasFilters(): boolean {
    return !!(
      this.filterKeyword.trim() ||
      this.filterPriority ||
      this.filterCategory ||
      this.filterArea ||
      (this.canManage && this.filterOnlyMine)
    );
  }

  load(): void {
    this.loading = true;
    this.truncado = false;
    if (this.role === 'AGENT') {
      this.ticketService.assigned().subscribe({
        next: (list) => this.populate(list),
        error: () => this.fail()
      });
    } else {
      // Antes se pedia una sola pagina de 500 y se descartaba el resto: por
      // encima de 500 tickets los restantes desaparecian del tablero sin
      // ningún aviso. Ahora se recorren todas las paginas.
      this.cargarTodas();
    }
  }

  /** Tope defensivo: evita un bucle infinito si el backend no avanzara. */
  private static readonly MAX_TICKETS = 2000;
  private static readonly PAGE_SIZE = 200;

  private cargarTodas(): void {
    const todos: Ticket[] = [];

    const siguiente = (page: number): void => {
      this.ticketService.search({ page, size: TicketKanbanComponent.PAGE_SIZE }).subscribe({
        next: (res) => {
          todos.push(...(res.content || []));
          const quedan = (res.totalElements ?? todos.length) - todos.length;
          if (quedan > 0 && todos.length < TicketKanbanComponent.MAX_TICKETS) {
            siguiente(page + 1);
          } else {
            this.truncado = quedan > 0;
            this.populate(todos);
          }
        },
        error: () => this.fail()
      });
    };

    siguiente(0);
  }

  private populate(tickets: Ticket[] | undefined): void {
    this.allTickets = tickets || [];
    this.applyFilters();
    this.loading = false;
  }

  private fail(): void {
    this.loading = false;
    this.toastService.error('No se pudieron cargar los tickets');
  }

  applyFilters(): void {
    const keyword = this.filterKeyword.trim().toLowerCase();
    const onlyMine = this.canManage && this.filterOnlyMine;

    this.columns.forEach((c) => (c.tickets = []));

    const matching = this.allTickets.filter((t) => {
      if (this.filterPriority && t.priority !== this.filterPriority) return false;
      if (this.filterCategory && t.category !== this.filterCategory) return false;
      if (this.filterArea && t.area !== this.filterArea) return false;
      if (onlyMine && (t.agent || '') !== this.currentUserEmail) return false;
      if (keyword) {
        const haystack = `${t.idTicket} ${t.titleTicket || ''} ${t.user || ''} ${t.category || ''}`
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });

    matching.forEach((t) => {
      const col = this.columns.find((c) => c.key === t.status);
      if (col) col.tickets.push(t);
    });
  }

  clearFilters(): void {
    this.filterKeyword = '';
    this.filterPriority = '';
    this.filterCategory = '';
    this.filterArea = '';
    this.filterOnlyMine = false;
    this.applyFilters();
  }

  openTicket(id: string): void {
    if (this.dragging) return;
    this.router.navigate(['/tickets', id]);
  }

  isSaving(id: string): boolean {
    return this.savingIds.has(id);
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
    if (this.isSaving(ticket.idTicket)) {
      return;
    }

    const fromKey = this.columns.find((c) => c.tickets === event.previousContainer.data)?.key;
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    const previousStatus = ticket.status;
    ticket.status = to.key;
    this.savingIds.add(ticket.idTicket);

    this.ticketService.changeStatus(ticket.idTicket, to.key).subscribe({
      next: () => {
        this.savingIds.delete(ticket.idTicket);
        this.toastService.success(`Movido a ${to.label}`, 'Estado actualizado');
      },
      error: (err) => {
        this.savingIds.delete(ticket.idTicket);
        ticket.status = previousStatus;
        this.toastService.error(err?.error?.message || 'No se pudo actualizar el estado');
        if (fromKey) {
          this.applyFilters();
        } else {
          this.load();
        }
      }
    });
  }

  relativeTime(date: string | null | undefined): string {
    if (!date) return '';
    const then = new Date(date).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Date.now() - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 30) return `hace ${days} d`;
    return new Date(date).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  displayName(t: Ticket): string {
    return t.userDisplayName || t.user || '?';
  }

  /** Inicial del avatar del solicitante: usa el correo, no la cédula. */
  solicitanteInicial(t: Ticket): string {
    const email = t.user && t.user.trim() ? t.user : t.userDisplayName;
    return email ? email.charAt(0).toUpperCase() : '?';
  }

  /**
   * Estado de sesión del solicitante. Es distinto de t.userStatus, que dice si la
   * cuenta está habilitada: esto dice si la persona está conectada ahora.
   */
  sesionSolicitante(t: Ticket): SessionState {
    return normalizarSesion(t.userSessionState);
  }

  sesionDot(t: Ticket): string {
    return metaSesion(t.userSessionState).dot;
  }

  sesionLabel(t: Ticket): string {
    return `Solicitante ${metaSesion(t.userSessionState).label.toLowerCase()}`;
  }

  solicitantePhoto(t: Ticket): string | null {
    const url = t.userPhotoUrl;
    if (!url) {
      return null;
    }
    return /^https?:\/\//i.test(url) ? url : `${environment.apiUrl}${url}`;
  }
}

import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, TicketTypeConfig } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-ticket-type-management',
  templateUrl: './ticket-type-management.component.html'
})
export class TicketTypeManagementComponent implements OnInit {
  types: TicketTypeConfig[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagTipos = new Paginacion<TicketTypeConfig>(() => this.types);
  loading = false;
  newType: Partial<TicketTypeConfig> = { icon: 'fa-solid fa-tag', color: '#062e86' };
  editType: TicketTypeConfig | null = null;
  showCreate = false;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getTicketTypes().subscribe({
      next: (c) => { this.types = c; this.loading = false; },
      error: () => { this.loading = false; this.toastService.error('No se pudieron cargar los tipos de ticket'); }
    });
  }

  create(): void {
    if (!this.newType.name || !this.newType.name.trim()) return;
    this.adminService.createTicketType(this.newType).subscribe({
      next: () => {
        this.load();
        this.newType = { icon: 'fa-solid fa-tag', color: '#062e86' };
        this.showCreate = false;
        this.toastService.success('Tipo de ticket creado');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  edit(t: TicketTypeConfig): void { this.editType = { ...t }; }
  cancelEdit(): void { this.editType = null; }

  saveEdit(): void {
    if (!this.editType || !this.editType.name?.trim()) return;
    this.adminService.updateTicketType(this.editType.id, {
      name: this.editType.name,
      description: this.editType.description,
      icon: this.editType.icon || '',
      color: this.editType.color || ''
    }).subscribe({
      next: () => { this.load(); this.editType = null; this.toastService.success('Tipo de ticket actualizado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar')
    });
  }

  delete(t: TicketTypeConfig): void {
    Swal.fire({ title: '¿Eliminar tipo de ticket?', text: t.name, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => {
        if (r.isConfirmed) {
          this.adminService.deleteTicketType(t.id).subscribe({
            next: () => { this.load(); this.toastService.success('Tipo de ticket eliminado'); },
            error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar')
          });
        }
      });
  }
}
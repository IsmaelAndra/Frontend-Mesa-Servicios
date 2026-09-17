import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, TicketTypeConfig } from '../../../core/services/admin.service';

@Component({
  selector: 'app-ticket-type-management',
  templateUrl: './ticket-type-management.component.html'
})
export class TicketTypeManagementComponent implements OnInit {
  types: TicketTypeConfig[] = [];
  loading = false;
  newType: Partial<TicketTypeConfig> = {};
  editType: TicketTypeConfig | null = null;
  showCreate = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getTicketTypes().subscribe({
      next: (c) => { this.types = c; this.loading = false; },
      error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar los tipos de ticket', 'error'); }
    });
  }

  create(): void {
    if (!this.newType.name || !this.newType.name.trim()) return;
    this.adminService.createTicketType(this.newType).subscribe({
      next: () => {
        this.load();
        this.newType = {};
        this.showCreate = false;
        Swal.fire('Éxito', 'Tipo de ticket creado', 'success');
      },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  edit(t: TicketTypeConfig): void { this.editType = { ...t }; }
  cancelEdit(): void { this.editType = null; }

  saveEdit(): void {
    if (!this.editType || !this.editType.name?.trim()) return;
    this.adminService.updateTicketType(this.editType.id, {
      name: this.editType.name,
      description: this.editType.description
    }).subscribe({
      next: () => { this.load(); this.editType = null; Swal.fire('Éxito', 'Tipo de ticket actualizado', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  delete(t: TicketTypeConfig): void {
    Swal.fire({ title: '¿Eliminar tipo de ticket?', text: t.name, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => {
        if (r.isConfirmed) {
          this.adminService.deleteTicketType(t.id).subscribe({
            next: () => this.load(),
            error: (e) => Swal.fire('Error', e?.error?.message, 'error')
          });
        }
      });
  }
}
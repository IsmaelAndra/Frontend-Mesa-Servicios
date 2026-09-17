import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, Area } from '../../../core/services/admin.service';

@Component({
  selector: 'app-area-management',
  templateUrl: './area-management.component.html'
})
export class AreaManagementComponent implements OnInit {
  areas: Area[] = [];
  loading = false;
  newArea: Partial<Area> = { statusArea: true, priorityLevel: 1 };
  editArea: Area | null = null;
  showCreate = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadAreas(); }

  loadAreas(): void {
    this.loading = true;
    this.adminService.getAreas().subscribe({
      next: (a) => { this.areas = a; this.loading = false; },
      error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar las áreas', 'error'); }
    });
  }

  create(): void {
    if (!this.newArea.nameArea) return;
    this.adminService.createArea(this.newArea).subscribe({
      next: () => { this.loadAreas(); this.newArea = { statusArea: true, priorityLevel: 1 }; this.showCreate = false; Swal.fire('Éxito', 'Área creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  edit(area: Area): void { this.editArea = { ...area }; }
  cancelEdit(): void { this.editArea = null; }

  saveEdit(): void {
    if (!this.editArea) return;
    this.adminService.updateArea(this.editArea.idArea, this.editArea).subscribe({
      next: () => { this.loadAreas(); this.editArea = null; Swal.fire('Éxito', 'Área actualizada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  delete(area: Area): void {
    Swal.fire({ title: '¿Eliminar área?', text: area.nameArea, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteArea(area.idArea).subscribe({ next: () => this.loadAreas(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }
}
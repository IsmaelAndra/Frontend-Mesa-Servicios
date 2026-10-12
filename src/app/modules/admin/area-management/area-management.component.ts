import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, Area } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-area-management',
  templateUrl: './area-management.component.html'
})
export class AreaManagementComponent implements OnInit {
  areas: Area[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagAreas = new Paginacion<Area>(() => this.areas);
  loading = false;
  newArea: Partial<Area> = { statusArea: true, priorityLevel: 1, iconArea: 'fa-solid fa-building', colorArea: '#062e86' };
  editArea: Area | null = null;
  showCreate = false;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void { this.loadAreas(); }

  loadAreas(): void {
    this.loading = true;
    this.adminService.getAreas().subscribe({
      next: (a) => { this.areas = a; this.loading = false; },
      error: () => { this.loading = false; this.toastService.error('No se pudieron cargar las áreas'); }
    });
  }

  private areaPayload(a: Partial<Area>): Record<string, unknown> {
    return {
      name: a.nameArea,
      description: a.descriptionArea || null,
      priorityLevel: a.priorityLevel,
      status: a.statusArea,
      icon: a.iconArea || '',
      color: a.colorArea || ''
    };
  }

  create(): void {
    if (!this.newArea.nameArea) return;
    this.adminService.createArea(this.areaPayload(this.newArea)).subscribe({
      next: () => { this.loadAreas(); this.newArea = { statusArea: true, priorityLevel: 1, iconArea: 'fa-solid fa-building', colorArea: '#062e86' }; this.showCreate = false; this.toastService.success('Área creada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  edit(area: Area): void { this.editArea = { ...area }; }
  cancelEdit(): void { this.editArea = null; }

  saveEdit(): void {
    if (!this.editArea) return;
    this.adminService.updateArea(this.editArea.idArea, this.areaPayload(this.editArea)).subscribe({
      next: () => { this.loadAreas(); this.editArea = null; this.toastService.success('Área actualizada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar')
    });
  }

  delete(area: Area): void {
    Swal.fire({ title: '¿Eliminar área?', text: area.nameArea, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteArea(area.idArea).subscribe({ next: () => this.loadAreas(), error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar') }); });
  }
}
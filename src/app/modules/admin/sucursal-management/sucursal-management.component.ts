import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService } from '../../../core/services/admin.service';
import { Sucursal } from '../../../models/user.model';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Catálogo de sedes de la institución.
 *
 * Una sede es la oficina física, distinta del área (a qué se dedica la
 * persona). Cada persona y cada ticket guardan la suya, así que el catálogo
 * alimenta los selectores del alta de usuarios y del ticket nuevo.
 */
@Component({
  selector: 'app-sucursal-management',
  templateUrl: './sucursal-management.component.html'
})
export class SucursalManagementComponent implements OnInit {
  sucursales: Sucursal[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagSucursales = new Paginacion<Sucursal>(() => this.sucursales);
  loading = false;
  newSucursal: Partial<Sucursal> = {
    statusSucursal: true,
    iconSucursal: 'fa-solid fa-city',
    colorSucursal: '#062e86'
  };
  editSucursal: Sucursal | null = null;
  showCreate = false;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getSucursales().subscribe({
      next: (lista) => {
        this.sucursales = lista;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastService.error('No se pudieron cargar las sedes');
      }
    });
  }

  private payload(s: Partial<Sucursal>): Record<string, unknown> {
    return {
      code: s.codeSucursal || '',
      name: s.nameSucursal,
      description: s.descriptionSucursal || null,
      address: s.addressSucursal || null,
      phone: s.phoneSucursal || null,
      status: s.statusSucursal,
      icon: s.iconSucursal || '',
      color: s.colorSucursal || ''
    };
  }

  create(): void {
    if (!this.newSucursal.nameSucursal || !this.newSucursal.codeSucursal) return;
    this.adminService.createSucursal(this.payload(this.newSucursal)).subscribe({
      next: () => {
        this.load();
        this.newSucursal = {
          statusSucursal: true,
          iconSucursal: 'fa-solid fa-city',
          colorSucursal: '#062e86'
        };
        this.showCreate = false;
        this.toastService.success('Sede creada');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear la sede')
    });
  }

  edit(sucursal: Sucursal): void {
    this.editSucursal = { ...sucursal };
  }

  cancelEdit(): void {
    this.editSucursal = null;
  }

  saveEdit(): void {
    if (!this.editSucursal) return;
    this.adminService.updateSucursal(this.editSucursal.idSucursal, this.payload(this.editSucursal)).subscribe({
      next: () => {
        this.load();
        this.editSucursal = null;
        this.toastService.success('Sede actualizada');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar la sede')
    });
  }

  delete(sucursal: Sucursal): void {
    Swal.fire({
      title: '¿Eliminar sede?',
      text: `${sucursal.nameSucursal}. Si tiene personas asignadas no se podrá borrar.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.adminService.deleteSucursal(sucursal.idSucursal).subscribe({
        next: () => {
          this.load();
          this.toastService.success('Sede eliminada');
        },
        // El backend avisa si quedan personas asignadas, y en ese caso conviene
        // desactivar la sede en lugar de borrarla.
        error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar la sede')
      });
    });
  }

  /** Sin icono se usa el de la ciudad, para que la fila nunca queda vacía. */
  iconoDe(sucursal: Sucursal): string {
    return sucursal.iconSucursal || 'fa-solid fa-city';
  }
}
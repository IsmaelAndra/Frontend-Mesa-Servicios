import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, Area } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';
import { OPCIONES_PRIORIDAD_AREA, PRIORIDAD_AREA_MAX, PRIORIDAD_AREA_MIN, nivelPrioridadArea } from '../../../core/utils/prioridad-area.util';
import { escaparHtml } from '../../../core/utils/escapar-html.util';

const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;
const AREA_NUEVA = (): Partial<Area> => ({ statusArea: true, priorityLevel: 1, iconArea: 'fa-solid fa-building', colorArea: '#062e86' });

@Component({
  selector: 'app-area-management',
  templateUrl: './area-management.component.html',
  styleUrls: ['./area-management.component.css'],
})
export class AreaManagementComponent implements OnInit {
  areas: Area[] = [];
  /** Búsqueda y orden en cliente: el endpoint devuelve la lista completa. */
  busqueda = '';
  orden: { campo: 'nombre' | 'prioridad' | 'estado'; asc: boolean } = { campo: 'prioridad', asc: false };
  readonly pagAreas = new Paginacion<Area>(() => this.areasVisibles());
  loading = false;
  guardando = false;
  newArea: Partial<Area> = AREA_NUEVA();
  editArea: Area | null = null;
  showCreate = false;
  /** Fila recién creada o editada: se resalta un momento. */
  resaltada: string | null = null;
  /** Fila que se está eliminando: se desvanece antes de salir. */
  saliendo: string | null = null;

  readonly opcionesPrioridad = OPCIONES_PRIORIDAD_AREA;
  readonly nivel = nivelPrioridadArea;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void { this.loadAreas(); }

  loadAreas(despues?: (a: Area[]) => void): void {
    this.loading = !this.areas.length;
    this.adminService.getAreas().subscribe({
      next: (a) => { this.areas = a; this.loading = false; despues?.(a); },
      error: () => { this.loading = false; this.toastService.error('No se pudieron cargar las áreas'); }
    });
  }

  // ------------------------------------------------------------ lista

  areasVisibles(): Area[] {
    const q = this.busqueda.trim().toLowerCase();
    const l = q
      ? this.areas.filter((a) => a.nameArea.toLowerCase().includes(q) || (a.descriptionArea || '').toLowerCase().includes(q))
      : [...this.areas];
    const dir = this.orden.asc ? 1 : -1;
    return l.sort((a, b) => {
      switch (this.orden.campo) {
        case 'nombre': return dir * a.nameArea.localeCompare(b.nameArea, 'es');
        case 'estado': return dir * (Number(a.statusArea) - Number(b.statusArea)) || a.nameArea.localeCompare(b.nameArea, 'es');
        default: return dir * (a.priorityLevel - b.priorityLevel) || a.nameArea.localeCompare(b.nameArea, 'es');
      }
    });
  }

  ordenarPor(campo: 'nombre' | 'prioridad' | 'estado'): void {
    this.orden = this.orden.campo === campo ? { campo, asc: !this.orden.asc } : { campo, asc: campo === 'nombre' };
    this.pagAreas.reiniciar();
  }

  iconoOrden(campo: string): string {
    if (this.orden.campo !== campo) return 'fa-sort opacity-40';
    return this.orden.asc ? 'fa-sort-up' : 'fa-sort-down';
  }

  ariaOrden(campo: string): 'ascending' | 'descending' | 'none' {
    return this.orden.campo !== campo ? 'none' : this.orden.asc ? 'ascending' : 'descending';
  }

  alBuscar(): void { this.pagAreas.reiniciar(); }

  trackArea(_: number, a: Area): string { return a.idArea; }

  /** Exporta lo que se ve (con búsqueda y orden) a un CSV que abre Excel. */
  exportar(): void {
    const filas = this.areasVisibles().map((a) => [
      a.nameArea, a.descriptionArea || '', String(a.priorityLevel), this.nivel(a.priorityLevel).etiqueta,
      a.statusArea ? 'Activa' : 'Inactiva', a.colorArea || '',
    ]);
    const csv = [['Nombre', 'Descripción', 'Prioridad', 'Nivel', 'Estado', 'Color'], ...filas]
      .map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `areas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------ validación

  /** Mensaje del primer problema del formulario, o null si se puede guardar. */
  error(a: Partial<Area> | null): string | null {
    if (!a) return null;
    const nombre = (a.nameArea || '').trim().replace(/\s+/g, ' ');
    if (!nombre) return 'Escriba el nombre del área';
    if (nombre.length > 100) return 'El nombre admite hasta 100 caracteres';
    const repetida = this.areas.some((x) => x.idArea !== a.idArea && x.nameArea.trim().toLowerCase() === nombre.toLowerCase());
    if (repetida) return `Ya existe un área llamada "${nombre}"`;
    const p = Number(a.priorityLevel);
    if (!Number.isInteger(p) || p < PRIORIDAD_AREA_MIN || p > PRIORIDAD_AREA_MAX) return 'La prioridad va de 1 a 10';
    if (a.colorArea && !COLOR_HEX.test(a.colorArea)) return 'El color debe tener la forma #RRGGBB';
    if ((a.descriptionArea || '').length > 255) return 'La descripción admite hasta 255 caracteres';
    return null;
  }

  private areaPayload(a: Partial<Area>): Record<string, unknown> {
    return {
      name: (a.nameArea || '').trim().replace(/\s+/g, ' '),
      description: (a.descriptionArea || '').trim() || '',
      priorityLevel: Number(a.priorityLevel),
      status: a.statusArea,
      icon: a.iconArea || '',
      color: a.colorArea || ''
    };
  }

  // ------------------------------------------------------------ CRUD

  alternarFormulario(): void {
    this.showCreate = !this.showCreate;
    if (this.showCreate) this.newArea = AREA_NUEVA();
  }

  create(): void {
    const e = this.error(this.newArea);
    if (e) { this.toastService.error(e); return; }
    this.guardando = true;
    this.adminService.createArea(this.areaPayload(this.newArea)).subscribe({
      next: (creada) => {
        this.guardando = false;
        this.showCreate = false;
        this.newArea = AREA_NUEVA();
        this.toastService.success('Área creada');
        this.loadAreas(() => this.resaltar(creada.idArea));
      },
      error: (err) => { this.guardando = false; this.toastService.error(err?.error?.message || 'No se pudo crear'); }
    });
  }

  edit(area: Area): void { this.editArea = { ...area, colorArea: area.colorArea || '#062e86' }; }
  cancelEdit(): void { this.editArea = null; }

  saveEdit(): void {
    if (!this.editArea) return;
    const e = this.error(this.editArea);
    if (e) { this.toastService.error(e); return; }
    const id = this.editArea.idArea;
    this.guardando = true;
    this.adminService.updateArea(id, this.areaPayload(this.editArea)).subscribe({
      next: () => {
        this.guardando = false;
        this.editArea = null;
        this.toastService.success('Área actualizada');
        this.loadAreas(() => this.resaltar(id));
      },
      error: (err) => { this.guardando = false; this.toastService.error(err?.error?.message || 'No se pudo actualizar'); }
    });
  }

  /**
   * Antes de eliminar pregunta qué apunta al área. Si está en uso, pide a qué
   * área pasar personas, equipos, categorías, tickets abiertos y proyectos.
   */
  delete(area: Area): void {
    this.adminService.usoArea(area.idArea).subscribe({
      next: (uso) => {
        const partes = [
          [uso.usuarios, 'persona', 'personas'], [uso.equipos, 'equipo', 'equipos'],
          [uso.categorias, 'categoría', 'categorías'], [uso.ticketsAbiertos, 'ticket abierto', 'tickets abiertos'],
          [uso.proyectos, 'proyecto', 'proyectos'],
        ].filter(([n]) => (n as number) > 0).map(([n, s, p]) => `<li><b>${n}</b> ${(n as number) === 1 ? s : p}</li>`);
        const destinos = this.areas.filter((a) => a.idArea !== area.idArea && a.statusArea);
        const nombre = escaparHtml(area.nameArea);
        if (partes.length && !destinos.length) {
          Swal.fire({ icon: 'error', title: 'No se puede eliminar', confirmButtonText: 'Entendido',
            html: `<b>${nombre}</b> está en uso y no hay otra área activa a la que pasar lo que tiene.` });
          return;
        }
        const opciones = destinos.map((d) => `<option value="${d.idArea}">${escaparHtml(d.nameArea)}</option>`).join('');
        Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
          title: '¿Eliminar área?',
          icon: 'warning',
          html: partes.length
            ? `<p class="mb-2"><b>${nombre}</b> todavía tiene:</p><ul class="text-left inline-block mb-3">${partes.join('')}</ul>`
              + `<label class="block text-sm text-left mb-1" for="swal-reasignar">Pasarlos al área</label>`
              + `<select id="swal-reasignar" class="select select-bordered select-sm w-full">${opciones}</select>`
            : `<b>${nombre}</b> no está en uso. Se quitará de la lista.`,
          showCancelButton: true,
          confirmButtonText: partes.length ? 'Reasignar y eliminar' : 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#dc2626',
          focusCancel: true,
          preConfirm: () => partes.length ? (document.getElementById('swal-reasignar') as HTMLSelectElement | null)?.value : '',
        }).then((r) => {
          if (!r.isConfirmed) return;
          this.adminService.deleteArea(area.idArea, r.value || undefined).subscribe({
            next: () => {
              this.saliendo = area.idArea;
              // Deja que la fila se desvanezca antes de quitarla.
              setTimeout(() => {
                this.areas = this.areas.filter((a) => a.idArea !== area.idArea);
                this.saliendo = null;
                this.loadAreas();
              }, 220);
              this.toastService.success(partes.length ? 'Área eliminada y su contenido reasignado' : 'Área eliminada');
            },
            error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar'),
          });
        });
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo revisar el uso del área'),
    });
  }

  private resaltar(id: string): void {
    this.resaltada = id;
    setTimeout(() => { if (this.resaltada === id) this.resaltada = null; }, 1600);
  }
}

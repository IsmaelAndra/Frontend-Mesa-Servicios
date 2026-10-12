import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, Category, SupportTeam } from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

@Component({
  selector: 'app-category-management',
  templateUrl: './category-management.component.html'
})
export class CategoryManagementComponent implements OnInit {
  categories: Category[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagCategorias = new Paginacion<Category>(() => this.categories);
  teams: SupportTeam[] = [];
  loading = false;
  newCategory: Partial<Category> = { iconCategory: 'fa-solid fa-tag', colorCategory: '#2563EB' };
  editCategory: Category | null = null;
  showCreate = false;

  /**
   * El select de equipo trabaja con `idTeam` y no con el objeto entero, para que
   * la comparación de la opción seleccionada sea por id. Al enviar se reconstruye
   * `teamCategory`, que es lo que espera AdminService.categoryPayload.
   */
  newTeamId: string | null = null;
  editTeamId: string | null = null;

  private emptyCategory(): Partial<Category> {
    return { iconCategory: 'fa-solid fa-tag', colorCategory: '#2563EB' };
  }

  /** Opciones de equipo con icono y color, para app-master-select. */
  get teamOptions(): MasterOption[] {
    return this.teams.map(t => ({
      value: t.idTeam,
      label: t.nameTeam,
      icon: t.iconTeam,
      color: t.colorTeam
    }));
  }

  private withTeam(data: Partial<Category>, teamId: string | null): Partial<Category> {
    const team = teamId != null ? this.teams.find(t => t.idTeam === teamId) : null;
    return { ...data, teamCategory: team ?? undefined };
  }

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getCategories().subscribe({ next: (c) => { this.categories = c; this.loading = false; }, error: () => { this.loading = false; this.toastService.error('No se pudieron cargar las categorías'); } });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
  }

  create(): void {
    if (!this.newCategory.nameCategory || !this.newTeamId) return;
    this.adminService.createCategory(this.withTeam(this.newCategory, this.newTeamId)).subscribe({
      next: () => {
        this.load();
        this.newCategory = this.emptyCategory();
        this.newTeamId = null;
        this.showCreate = false;
        this.toastService.success('Categoría creada');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  edit(cat: Category): void {
    this.editCategory = { ...cat };
    this.editTeamId = cat.teamCategory?.idTeam ?? null;
  }

  cancelEdit(): void {
    this.editCategory = null;
    this.editTeamId = null;
  }

  saveEdit(): void {
    if (!this.editCategory) return;
    const payload = this.withTeam(this.editCategory, this.editTeamId);
    this.adminService.updateCategory(this.editCategory.idCategory, payload).subscribe({
      next: () => {
        this.load();
        this.cancelEdit();
        this.toastService.success('Categoría actualizada');
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar')
    });
  }

  delete(cat: Category): void {
    Swal.fire({ title: '¿Eliminar categoría?', text: cat.nameCategory, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteCategory(cat.idCategory).subscribe({ next: () => { this.load(); this.toastService.success('Categoría eliminada'); }, error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar') }); });
  }
}
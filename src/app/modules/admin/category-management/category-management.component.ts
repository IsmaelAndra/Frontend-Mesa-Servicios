import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, Category, SupportTeam } from '../../../core/services/admin.service';

@Component({
  selector: 'app-category-management',
  templateUrl: './category-management.component.html'
})
export class CategoryManagementComponent implements OnInit {
  categories: Category[] = [];
  teams: SupportTeam[] = [];
  loading = false;
  newCategory: Partial<Category> = {};
  editCategory: Category | null = null;
  showCreate = false;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getCategories().subscribe({ next: (c) => { this.categories = c; this.loading = false; }, error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar las categorías', 'error'); } });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
  }

  create(): void {
    if (!this.newCategory.nameCategory || !this.newCategory.teamCategory?.idTeam) return;
    this.adminService.createCategory(this.newCategory).subscribe({
      next: () => { this.load(); this.newCategory = {}; this.showCreate = false; Swal.fire('Éxito', 'Categoría creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  edit(cat: Category): void { this.editCategory = { ...cat }; }
  cancelEdit(): void { this.editCategory = null; }

  saveEdit(): void {
    if (!this.editCategory) return;
    this.adminService.updateCategory(this.editCategory.idCategory, this.editCategory).subscribe({
      next: () => { this.load(); this.editCategory = null; Swal.fire('Éxito', 'Categoría actualizada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  delete(cat: Category): void {
    Swal.fire({ title: '¿Eliminar categoría?', text: cat.nameCategory, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteCategory(cat.idCategory).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }
}
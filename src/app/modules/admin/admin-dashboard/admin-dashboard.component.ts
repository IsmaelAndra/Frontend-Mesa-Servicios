import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { Catalog } from '../../../models/user.model';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  catalog?: Catalog;

  constructor(private adminService: AdminService, private authService: AuthService) { }

  get isSuperAdmin(): boolean {
    return this.authService.getRole() === 'SUPER_ADMIN';
  }

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => Swal.fire('Error', 'No se pudo cargar el catálogo', 'error')
    });
  }

  getActiveAreasCount(): number {
    return this.catalog?.areas?.filter(a => a.status).length ?? 0;
  }
}
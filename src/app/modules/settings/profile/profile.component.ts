import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html'
})
export class SettingsProfileComponent implements OnInit {
  user: User | null = null;
  loading = false;
  editMode = false;
  form: Partial<User> = {};

  constructor(private authService: AuthService, private adminService: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.authService.me().subscribe({
      next: (u) => { this.user = u; this.form = { ...u }; },
      error: () => Swal.fire('Error', 'No se pudo cargar el perfil', 'error')
    });
  }

  get initial(): string {
    return this.user?.corporateEmailUser?.charAt(0).toUpperCase() || 'U';
  }

  toggleEdit(): void { this.editMode = !this.editMode; if (this.editMode) this.form = { ...this.user! }; }

  save(): void {
    if (!this.user) return;
    this.loading = true;
    this.adminService.updateUser(this.user.idUser, this.form as any).subscribe({
      next: () => { this.loading = false; this.editMode = false; this.load(); Swal.fire('Éxito', 'Perfil actualizado', 'success'); },
      error: (e) => { this.loading = false; Swal.fire('Error', e?.error?.message, 'error'); }
    });
  }

  cancel(): void { this.editMode = false; this.form = { ...this.user! }; }
}
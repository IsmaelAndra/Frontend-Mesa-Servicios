import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { User } from '../../../models/user.model';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class SettingsProfileComponent implements OnInit {
  user: User | null = null;
  loading = false;
  editMode = false;
  form: Partial<User> = {};
  /** La cuenta tiene doble factor: guardar los datos pide el código de la app. */
  pideCodigoMfa = false;
  codigoMfa = '';
  coverUrl = 'https://images.unsplash.com/photo-1499336315816-097655dcfbda?auto=format&fit=crop&w=1920&q=80';

  constructor(private authService: AuthService, private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.authService.pideCodigoMfa().subscribe((pide) => (this.pideCodigoMfa = pide));
    this.adminService.getBranding().subscribe({
      next: (b) => { if (b.profileCoverUrl) this.coverUrl = b.profileCoverUrl; },
      error: () => undefined
    });
    this.load();
  }

  load(): void {
    this.authService.me().subscribe({
      next: (u) => { this.user = u; this.form = { ...u }; },
      error: () => this.toastService.error('No se pudo cargar el perfil')
    });
  }

  get initial(): string {
    if (this.user?.displayName) {
      return this.user.displayName.charAt(0).toUpperCase();
    }
    if (this.user?.firstName) {
      return this.user.firstName.charAt(0).toUpperCase();
    }
    return this.user?.corporateEmailUser?.charAt(0).toUpperCase() || 'U';
  }

  get fullName(): string {
    const u = this.user;
    if (!u) return '';
    if (u.displayName?.trim()) return u.displayName.trim();
    const full = [u.firstName, u.lastName].map((p) => p?.trim()).filter(Boolean).join(' ');
    if (full) return full;
    // Sin nombre de Outlook ni nombres propios: se usa la parte del correo antes
    // de la arroba, con las iniciales en mayuscula (mismo criterio que las
    // tarjetas de usuarios).
    const correo = (u.corporateEmailUser || '').trim();
    const local = correo.includes('@') ? correo.split('@')[0] : correo;
    if (!local) return 'Sin nombre';
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }

  get activo(): boolean {
    return this.user?.statusUser === 'ACTIVE';
  }

  /** Nombres y apellidos propios, si los hay (aparte del nombre para mostrar). */
  get nombresCompletos(): string {
    const u = this.user;
    if (!u) return '';
    return [u.firstName, u.lastName].map((p) => p?.trim()).filter(Boolean).join(' ');
  }

  get roleLabel(): string {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrador',
      ADMIN: 'Administrador',
      AGENT: 'Agente',
      USER: 'Usuario'
    };
    if (!this.user) return '';
    return map[(this.user.role || '').toUpperCase()] ?? this.user.role;
  }

  get photoSrc(): string | null {
    if (!this.user?.photoUrl) return null;
    if (/^https?:\/\//i.test(this.user.photoUrl)) return this.user.photoUrl;
    return `${environment.apiUrl}${this.user.photoUrl}`;
  }

  toggleEdit(): void { this.editMode = !this.editMode; if (this.editMode) this.form = { ...this.user! }; }

  save(): void {
    if (!this.user) return;
    this.loading = true;

    // Antes se mandaba el objeto User entero contra PUT /users/{id}, que es la
    // ruta de administracion y valida un RegisterRequest con roleName y areaId.
    // El formulario no manda esos campos, asi que el backend respondia 400. Se
    // envia solo lo que la persona puede editar sobre si misma, a /users/me.
    const payload = {
      identificationUser: (this.form.identificationUser || '').trim(),
      phoneUser: (this.form.phoneUser || '').trim(),
      firstName: (this.form.firstName || '').trim(),
      lastName: (this.form.lastName || '').trim(),
      displayName: (this.form.displayName || '').trim(),
      codigoMfa: this.pideCodigoMfa ? this.codigoMfa.trim() : null
    };

    this.adminService.updateMyProfile(payload).subscribe({
      next: (u) => {
        this.loading = false;
        this.editMode = false;
        this.user = u;
        this.form = { ...u };
        this.codigoMfa = '';
        this.toastService.success('Perfil actualizado');
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(e?.error?.message || 'No se pudo actualizar el perfil');
      }
    });
  }

  cancel(): void { this.editMode = false; this.form = { ...this.user! }; }
}
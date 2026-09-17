import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService } from '../../../core/services/admin.service';
import { Catalog, RegisterRequest, User } from '../../../models/user.model';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  areas: { id: number; name: string }[] = [];
  roles = ['ADMIN', 'AGENT', 'USER'];
  search = '';
  role = '';
  status = '';

  roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrador',
    ADMIN: 'Administrador',
    AGENT: 'Agente',
    USER: 'Usuario'
  };

  roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: 'Acceso total: administración y configuración avanzada',
    ADMIN: 'Gestiona usuarios, áreas, configuraciones y reportes',
    AGENT: 'Atiende y resuelve los tickets asignados',
    USER: 'Crea y da seguimiento a sus propios tickets'
  };

  getRoleLabel(role: string): string {
    return this.roleLabels[role] || role;
  }

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.adminService.catalog().subscribe({ next: (c: Catalog) => (this.areas = c.areas) });
  }

  loadUsers(): void {
    this.adminService.users(this.role, this.status, this.search).subscribe({
      next: (u) => (this.users = u),
      error: () => Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error')
    });
  }

  setStatus(u: User): void {
    const newStatus = u.statusUser === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.adminService.setUserStatus(u.idUser, newStatus).subscribe({
      next: () => this.loadUsers(),
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  async createOrEditUser(user?: User): Promise<void> {
    const { value: form } = await Swal.fire({
      title: user ? 'Editar usuario' : 'Nuevo usuario',
      html: `
        <div class="text-left space-y-2 text-sm">
          <label>Identificación</label>
          <input id="idn" class="input input-bordered input-sm w-full" value="${user?.identificationUser || ''}" />
          <label>Correo corporativo</label>
          <input id="email" class="input input-bordered input-sm w-full" value="${user?.corporateEmailUser || ''}" />
          <label>Teléfono</label>
          <input id="phone" class="input input-bordered input-sm w-full" value="${user?.phoneUser || ''}" />
          <label>Contraseña ${user ? '(dejar vacío para no cambiar)' : '(dejar vacío para generarla y enviarla al correo del usuario)'}</label>
          <input id="pass" type="password" class="input input-bordered input-sm w-full" />
        </div>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const g = (i: string) => (Swal.getPopup()!.querySelector(`#${i}`) as HTMLInputElement).value;
        return {
          identification: g('idn'), corporateEmail: g('email'), phone: g('phone'), password: g('pass')
        };
      }
    });

    if (!form) return;

    const areaSel = await this.pickArea(user?.area);
    if (areaSel === undefined) return;

    const roleSel = await this.pickRole(user?.role);
    if (roleSel === undefined) return;

    const payload: RegisterRequest = {
      identification: form.identification,
      corporateEmail: form.corporateEmail,
      phone: form.phone,
      roleName: roleSel,
      areaId: areaSel
    };
    if (form.password) {
      payload.password = form.password;
    }

    const obs = user
      ? this.adminService.updateUser(user.idUser, payload)
      : this.adminService.createUser(payload);

    obs.subscribe({
      next: () => { this.loadUsers(); Swal.fire({ icon: 'success', title: 'Guardado', timer: 1300, showConfirmButton: false }); },
      error: (e) => Swal.fire('Error', e?.error?.message || 'No se pudo guardar', 'error')
    });
  }

  deleteUser(u: User): void {
    Swal.fire({
      title: '¿Eliminar usuario?',
      text: u.corporateEmailUser,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33'
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.deleteUser(u.idUser).subscribe({
          next: () => this.loadUsers(),
          error: (e) => Swal.fire('Error', e?.error?.message, 'error')
        });
      }
    });
  }

  pickArea(current?: string): Promise<number | undefined> {
    const currentId = this.areas.find((a) => a.name === current)?.id;
    return this.pickIdSelect('Área', this.areas.map((a) => ({ value: a.id, label: a.name })), currentId);
  }

  pickRole(current?: string): Promise<string | undefined> {
    const opts = this.roles
      .map((r) => `
        <label style="display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:6px;cursor:pointer;${r === current ? 'background:#eef2ff;border-color:#6366f1;' : ''}">
          <input type="radio" name="roleopt" value="${r}" ${r === current ? 'checked' : ''} style="margin-top:3px;" />
          <span style="display:block;">
            <span style="display:block;font-weight:600;font-size:14px;">${this.getRoleLabel(r)}</span>
            <span style="display:block;font-size:12px;opacity:0.7;">${this.roleDescriptions[r] || ''}</span>
          </span>
        </label>`)
      .join('');

    return new Promise((resolve) => {
      Swal.fire({
        title: 'Seleccione el rol',
        html: `<div>${opts}</div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Aceptar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
          const sel = Swal.getPopup()!.querySelector('input[name="roleopt"]:checked') as HTMLInputElement;
          return sel ? sel.value : '';
        }
      }).then((r) => resolve(r.isConfirmed && r.value ? r.value : undefined));
    });
  }

  private async pickIdSelect(label: string, options: { value: number; label: string }[], currentId?: number): Promise<number | undefined> {
    const opts = options
      .map((o) => `<option value="${o.value}" ${o.value === currentId ? 'selected' : ''}>${o.label}</option>`)
      .join('');
    const { value } = await Swal.fire({
      title: `Seleccione ${label}`,
      html: `<select id="swal-select" class="select select-bordered select-sm w-full">${opts}</select>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const sel = Swal.getPopup()!.querySelector('#swal-select') as HTMLSelectElement;
        return sel.value === '' ? undefined : Number(sel.value);
      }
    });
    return value;
  }
}
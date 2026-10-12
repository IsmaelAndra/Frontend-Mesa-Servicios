import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Catalog } from '../../../models/user.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html'
})
export class RegisterComponent implements OnInit {
  form: FormGroup;
  loading = false;
  areas: { id: string; name: string; icon?: string; color?: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      identification: ['', [Validators.required, Validators.minLength(6)]],
      corporateEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      phone: [''],
      areaId: [null, Validators.required],
      roleName: ['USER']
    });
  }

  ngOnInit(): void {
    this.adminService.catalog().subscribe({
      next: (c: Catalog) => (this.areas = c.areas.filter((a) => a.status)),
      error: () => this.toastService.warn('No se pudieron cargar las áreas')
    });
  }

  /** Adapta las áreas del catálogo a las opciones del select de maestros. */
  masterOptions(
    list: { id: string; name: string; icon?: string; color?: string }[] | undefined
  ): MasterOption[] {
    return (list || []).map(a => ({
      value: a.id,
      label: a.name,
      icon: a.icon,
      color: a.color
    }));
  }

  register(): void {
    if (this.form.invalid) {
      this.toastService.warn('Complete correctamente los campos');
      return;
    }
    this.loading = true;
    this.authService.register(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.success('Bienvenido a la Mesa de Servicios', 'Cuenta creada');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'No se pudo registrar');
      }
    });
  }
}
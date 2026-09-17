import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Catalog } from '../../../models/user.model';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html'
})
export class RegisterComponent implements OnInit {
  form: FormGroup;
  loading = false;
  areas: { id: number; name: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router
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
      error: () => Swal.fire('Aviso', 'No se pudieron cargar las áreas', 'warning')
    });
  }

  register(): void {
    if (this.form.invalid) {
      Swal.fire('Atención', 'Complete correctamente los campos', 'warning');
      return;
    }
    this.loading = true;
    this.authService.register(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({ icon: 'success', title: 'Cuenta creada', text: 'Bienvenido a la Mesa de Ayuda', timer: 1800, showConfirmButton: false });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.message || 'No se pudo registrar', 'error');
      }
    });
  }
}
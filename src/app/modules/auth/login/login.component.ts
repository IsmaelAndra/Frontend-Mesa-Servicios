import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  loading = false;
  showPassword = false;
  logoUrl = '';
  backgroundUrl = '';
  currentYear = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private adminService: AdminService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadBranding();
  }

  loadBranding(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => {
        this.logoUrl = b.logoUrl || '';
        this.backgroundUrl = b.backgroundUrl || '';
      },
      error: () => {
        this.logoUrl = '';
        this.backgroundUrl = '';
      }
    });
  }

  forgotPassword(): void {
    Swal.fire({
      title: 'Restablecer contraseña',
      html: `
        <p class="text-sm opacity-80 mb-2">Te enviaremos una contraseña temporal a tu correo corporativo.</p>
        <input id="femail" type="email" class="input input-bordered w-full" placeholder="usuario@coacmagisterio.fin.ec" />
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const input = Swal.getPopup()!.querySelector('#femail') as HTMLInputElement;
        const value = input?.value?.trim() || '';
        if (!value) {
          Swal.showValidationMessage('Ingrese su correo corporativo');
          return false;
        }
        return value;
      }
    }).then((result) => {
      if (result.value) {
        this.authService.forgotPassword(result.value).subscribe({
          next: () => Swal.fire(
            'Listo',
            'Se ha enviado una contraseña temporal a su correo. Inicie sesión y cámbiela al entrar.',
            'success'
          ),
          error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo restablecer la contraseña', 'error')
        });
      }
    });
  }

  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire('Atención', 'Complete correctamente los campos', 'warning');
      return;
    }

    this.loading = true;
    this.authService.login(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        if (this.authService.mustChangePassword()) {
          Swal.fire({
            icon: 'info',
            title: 'Cambia tu contraseña',
            text: 'Por seguridad debes crear una nueva contraseña antes de continuar.',
            timer: 2000,
            showConfirmButton: false
          });
          this.router.navigate(['/settings/password']);
          return;
        }
        Swal.fire({ icon: 'success', title: 'Bienvenido', timer: 1500, showConfirmButton: false });
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        const status = err?.status;
        if (status === 0 || status == null) {
          Swal.fire('Sin conexión', 'No se pudo conectar con el servidor (' + environment.apiUrl + '). Verifique que el backend esté corriendo.', 'error');
        } else if (status === 401) {
          Swal.fire('Error', 'Credenciales incorrectas', 'error');
        } else if (status === 403) {
          Swal.fire('Error', 'Acceso denegado', 'error');
        } else if (status >= 500) {
          Swal.fire('Error', 'Error interno del servidor. Intente más tarde.', 'error');
        } else {
          Swal.fire('Error', err?.error?.message || 'No se pudo iniciar sesión', 'error');
        }
      }
    });
  }
}
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { ThemeService } from '../../../core/services/theme.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit, OnDestroy {
  form: FormGroup;
  loading = false;
  showPassword = false;
  isDark = false;
  logoUrl = '';
  backgroundUrl = '';
  currentYear = new Date().getFullYear();
  private themeSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private adminService: AdminService,
    private themeService: ThemeService,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.themeSub = this.themeService.theme.subscribe((theme) => {
      this.isDark = theme === 'dark';
    });
    this.loadBranding();
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

toggleTheme(): void {
    this.themeService.toggle();
  }

  loadBranding(): void {
    this.adminService.getBranding().subscribe({
      next: (b) => {
        this.logoUrl = b.logoLoginUrl || b.logoUrl || '';
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
          <p class="text-sm opacity-80 mb-2">Le enviaremos un enlace a su correo corporativo para que establezca su nueva contraseña.</p>
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
next: () => this.toastService.success(
              // A propósito no se distingue si el correo existe: si el mensaje
              // fuera distinto, esta pantalla serviría para enumerar los correos
              // de la organización.
              'Si el correo corresponde a una cuenta activa, recibirá un enlace para establecer una nueva contraseña.',
              'Listo'
            ),
          error: (err) => this.toastService.error(err?.error?.message || 'No se pudo restablecer la contraseña')
        });
      }
    });
  }

  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.warn('Complete correctamente los campos');
      return;
    }

this.loading = true;
      this.authService.login(this.form.value).subscribe({
        next: (res) => {
          this.loading = false;
          // Si el backend devuelve un desafío, la contraseña era correcta pero
          // falta el segundo factor: no hay sesión todavía, así que hay que
          // llevarle a la pantalla del código en lugar de al panel.
          if (AuthService.esDesafio(res)) {
            this.router.navigate(['/auth/mfa']);
            return;
          }
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
        this.toastService.success('Bienvenido');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        const status = err?.status;
        if (status === 0 || status == null) {
          Swal.fire('Sin conexión', 'No se pudo conectar con el servidor (' + environment.apiUrl + '). Verifique que el backend esté corriendo.', 'error');
        } else if (status === 401) {
          this.toastService.error('Credenciales incorrectas');
        } else if (status === 403) {
          this.toastService.error('Acceso denegado');
        } else if (status >= 500) {
          this.toastService.error('Error interno del servidor. Intente más tarde.');
        } else {
          this.toastService.error(err?.error?.message || 'No se pudo iniciar sesión');
        }
      }
    });
  }
}
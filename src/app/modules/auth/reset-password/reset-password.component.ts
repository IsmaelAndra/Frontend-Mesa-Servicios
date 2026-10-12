import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Pantalla a la que lleva el enlace del correo de restablecimiento.
 *
 * <p>Antes del cambio no existía: la contraseña se mandaba ya generada y el
 * usuario solo tenía que copiarla. Ahora es aquí donde se elige, que es lo que
 * convierte el correo en una prueba de titularidad.
 *
 * <p>El token viaja en la query y no se guarda en ningún sitio: si alguien
 * abre la URL, lo ve, pero no queda en localStorage como el access token.
 */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  form!: FormGroup;
  token = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nuevaPassword: ['', [Validators.required, Validators.minLength(8)]],
      repetirPassword: ['', [Validators.required]]
    });
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  get sinToken(): boolean {
    return !this.token;
  }

  get contrasenasNoCoinciden(): boolean {
    const a = this.form.get('nuevaPassword')?.value;
    const b = this.form.get('repetirPassword')?.value;
    return !!a && !!b && a !== b;
  }

  get puedeEnviar(): boolean {
    return !this.sinToken && this.form.valid && !this.contrasenasNoCoinciden && !this.loading;
  }

  enviar(): void {
    if (!this.puedeEnviar) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.authService.resetPassword(this.token, this.form.value.nuevaPassword).subscribe({
      next: (res) => {
        this.toastService.success(res.message, 'Contraseña actualizada');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'No se pudo establecer la contraseña');
      }
    });
  }
}
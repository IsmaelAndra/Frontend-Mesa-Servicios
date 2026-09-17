import { Component } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-password',
  templateUrl: './password.component.html'
})
export class SettingsPasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  loading = false;

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  constructor(private authService: AuthService, private router: Router) {}

  // ============ Fortaleza de la nueva contraseña ============

  /** Puntaje de 0 a 4 según los criterios cumplidos */
  private get strengthScore(): number {
    const p = this.newPassword || '';
    if (!p) return 0;

    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    return Math.min(score, 4);
  }

  get strengthPercent(): number {
    const map = [0, 25, 50, 75, 100];
    return map[this.strengthScore] ?? 0;
  }

  get strengthLabel(): string {
    const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
    return labels[this.strengthScore] ?? '';
  }

  get strengthColor(): string {
    const colors = ['bg-error', 'bg-error', 'bg-warning', 'bg-info', 'bg-success'];
    return colors[this.strengthScore] ?? 'bg-base-300';
  }

  get strengthTextColor(): string {
    const colors = ['text-error', 'text-error', 'text-warning', 'text-info', 'text-success'];
    return colors[this.strengthScore] ?? 'opacity-60';
  }

  // ============ Cambiar contraseña ============

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      Swal.fire('Atención', 'Complete todos los campos', 'warning');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
      return;
    }
    if (this.newPassword.length < 8) {
      Swal.fire('Error', 'La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    if (this.newPassword === this.currentPassword) {
      Swal.fire('Atención', 'La nueva contraseña debe ser diferente a la actual', 'warning');
      return;
    }

    this.loading = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.authService.clearMustChangePassword();

        // Reset completo del formulario
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showCurrent = false;
        this.showNew = false;
        this.showConfirm = false;

        Swal.fire({
          icon: 'success',
          title: 'Contraseña cambiada',
          text: 'Tu contraseña ha sido actualizada correctamente.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => this.router.navigate(['/dashboard']));
      },
      error: (e) => {
        this.loading = false;
        Swal.fire('Error', e?.error?.message || 'No se pudo cambiar la contraseña', 'error');
      }
    });
  }
}
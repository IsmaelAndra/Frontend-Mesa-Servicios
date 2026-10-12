import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-session-config',
  templateUrl: './session-config.component.html'
})
export class SessionConfigComponent implements OnInit {
  form: FormGroup;
  isLoading = true;
  isSaving = false;

  readonly limites = { min: 5, max: 1440 };

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      sessionMinutes: [15, [Validators.required, Validators.min(this.limites.min), Validators.max(this.limites.max)]],
      warningMinutes: [5, [Validators.required, Validators.min(1), Validators.max(this.limites.max)]],
      autoRenew: [true],
      idleEnabled: [true],
      idleMinutes: [15, [Validators.required, Validators.min(1), Validators.max(this.limites.max)]]
    });
  }

  /** Con el cierre por inactividad apagado, el campo de minutos no aplica. */
  get idleActivo(): boolean {
    return !!this.form.get('idleEnabled')?.value;
  }

  ngOnInit(): void {
    this.adminService
      .getSessionConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.form.patchValue({
            sessionMinutes: cfg.sessionMinutes,
            warningMinutes: cfg.warningMinutes,
            autoRenew: cfg.autoRenew,
            idleEnabled: cfg.idleEnabled,
            idleMinutes: cfg.idleMinutes
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toastService.error('No se pudo cargar la configuración de sesión');
        }
      });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.warn(
        `Revisa los valores: la sesión va de ${this.limites.min} a ${this.limites.max} minutos.`
      );
      return;
    }

    const value = this.form.value;
    if (value.warningMinutes >= value.sessionMinutes) {
      this.toastService.warn('El aviso debe ser menor que la duración de la sesión.');
      return;
    }

    this.isSaving = true;
    this.adminService
      .updateSessionConfig(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.isSaving = false;
          this.form.patchValue({
            sessionMinutes: cfg.sessionMinutes,
            warningMinutes: cfg.warningMinutes,
            autoRenew: cfg.autoRenew,
            idleEnabled: cfg.idleEnabled,
            idleMinutes: cfg.idleMinutes
          });
          this.toastService.success('Configuración de sesión actualizada');
        },
        error: () => {
          this.isSaving = false;
          this.toastService.error('No se pudo guardar la configuración');
        }
      });
  }

  invalid(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  /** "1h 45m" a partir de los minutos, para la vista previa. */
  resumen(): string {
    const m = this.form.get('sessionMinutes')?.value || 0;
    if (!m) return '—';
    if (m < 60) return `${m} minutos`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h} horas`;
  }

  /** Igual que resumen(), pero para el tiempo de inactividad. */
  resumenInactividad(): string {
    const m = this.form.get('idleMinutes')?.value || 0;
    if (!m) return '—';
    if (m < 60) return `${m} minutos`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h} horas`;
  }
}

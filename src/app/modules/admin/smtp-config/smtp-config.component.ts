import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminService, SmtpConfigAdmin } from '../../../core/services/admin.service';

@Component({
  selector: 'app-smtp-config',
  templateUrl: './smtp-config.component.html',
  styleUrl: './smtp-config.component.css'
})
export class SmtpConfigComponent implements OnInit {
  smtpConfig: SmtpConfigAdmin = {} as SmtpConfigAdmin;
  smtpForm: FormGroup;

  isLoading = false;   // spinner al cargar/guardar
  isTesting = false;   // spinner al probar
  showPassword = false;
  testResult: { success: boolean; message: string } | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {
    this.smtpForm = this.fb.group({
      hostSmtp: ['', [Validators.required]],
      portSmtp: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
      usernameSmtp: ['', [Validators.required]],
      passwordSmtp: ['', [Validators.required]],
      fromAddress: ['', [Validators.required, Validators.email]],
      displayName: [''],
      useTls: [true],
      enabledSmtp: [true]
    });
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    this.isLoading = true;
    this.adminService
      .getSmtpConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: SmtpConfigAdmin) => {
          this.smtpConfig = config;
          this.smtpForm.patchValue(config);
          this.isLoading = false;
        },
        error: (err: any) => {
          console.error('Error cargando configuración SMTP', err);
          this.isLoading = false;
          Swal.fire('Error', 'No se pudo cargar la configuración SMTP', 'error');
        }
      });
  }

  onSave(): void {
    if (this.smtpForm.invalid) {
      this.smtpForm.markAllAsTouched();
      Swal.fire('Atención', 'Complete los campos requeridos', 'warning');
      return;
    }

    this.isLoading = true;
    const config: SmtpConfigAdmin = this.smtpForm.value as SmtpConfigAdmin;

    this.adminService
      .updateSmtpConfig(config)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: SmtpConfigAdmin) => {
          this.smtpConfig = config;
          this.isLoading = false;
          Swal.fire({
            icon: 'success',
            title: 'Configuración guardada',
            timer: 1300,
            showConfirmButton: false
          });
          this.loadConfig();
        },
        error: (err: any) => {
          console.error('Error guardando configuración SMTP', err);
          this.isLoading = false;
          Swal.fire('Error', err?.error?.message || 'No se pudo guardar la configuración', 'error');
        }
      });
  }

  testConfig(): void {
    if (this.smtpForm.invalid) {
      this.smtpForm.markAllAsTouched();
      Swal.fire('Atención', 'Complete los campos requeridos antes de probar', 'warning');
      return;
    }

    const options = {
      to: this.smtpForm.value.fromAddress, // se envía a sí mismo por defecto
      host: this.smtpForm.value.hostSmtp || '',
      port: this.smtpForm.value.portSmtp || 587,
      username: this.smtpForm.value.usernameSmtp || '',
      password: this.smtpForm.value.passwordSmtp || '',
      from: this.smtpForm.value.fromAddress || '',
      useTls: this.smtpForm.value.useTls || false
    };

    this.isTesting = true;
    this.testResult = null;

    this.adminService
      .testSmtp(options)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: { success: boolean; message: string }) => {
          this.testResult = result;
          this.isTesting = false;
        },
        error: (err: any) => {
          console.error('Error en prueba SMTP', err);
          this.testResult = {
            success: false,
            message: err?.error?.message || err?.message || 'Error desconocido'
          };
          this.isTesting = false;
        }
      });
  }
}
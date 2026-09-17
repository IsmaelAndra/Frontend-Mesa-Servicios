import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { AdminService, AiConfigAdmin } from '../../../core/services/admin.service';

@Component({
  selector: 'app-ai-config',
  templateUrl: './ai-config.component.html'
})
export class AiConfigComponent implements OnInit {
  aiForm: FormGroup;
  isLoading = false;
  showApiKey = false;
  apiKeyMasked: string | null = null;

  readonly providers = ['OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'OLLAMA'];

  private destroyRef = inject(DestroyRef);

  constructor(private adminService: AdminService, private fb: FormBuilder) {
    this.aiForm = this.fb.group({
      enabled: [false],
      provider: ['OPENAI', [Validators.required]],
      model: ['gpt-4o-mini', [Validators.required]],
      apiKey: [''],
      baseUrl: ['']
    });
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    this.isLoading = true;
    this.adminService.getAiConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.apiKeyMasked = config.apiKeyMasked;
          this.aiForm.patchValue({
            enabled: config.enabled,
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: ''
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          Swal.fire('Error', 'No se pudo cargar la configuración de IA', 'error');
        }
      });
  }

  onSave(): void {
    if (this.aiForm.invalid) {
      this.aiForm.markAllAsTouched();
      Swal.fire('Atención', 'Complete los campos requeridos', 'warning');
      return;
    }

    this.isLoading = true;
    const payload = this.aiForm.value as AiConfigAdmin;
    this.adminService.updateAiConfig(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading = false;
          Swal.fire({ icon: 'success', title: 'Configuración guardada', timer: 1300, showConfirmButton: false });
          this.loadConfig();
        },
        error: (err: any) => {
          this.isLoading = false;
          Swal.fire('Error', err?.error?.message || 'No se pudo guardar la configuración', 'error');
        }
      });
  }
}
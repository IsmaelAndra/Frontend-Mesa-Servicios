import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import {
  AdminService,
  DailySummaryResponse,
  GraphAuditItem,
  MicrosoftGraphConfigAdmin,
  MicrosoftGraphConfigResponse,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";
import { Paginacion } from "../../../core/utils/pagination.util";

@Component({
  selector: "app-microsoft-graph-config",
  templateUrl: "./microsoft-graph-config.component.html",
  styleUrl: "./microsoft-graph-config.component.css",
})
export class MicrosoftGraphConfigComponent implements OnInit {
  form!: FormGroup;
  config: MicrosoftGraphConfigResponse | null = null;
  audit: GraphAuditItem[] = [];

  /**
   * Pestaña activa. Antes todo estaba en un formulario largo de 350 lineas:
   * conexion, correo y auditoria quedaban mezclados y habia que hacer scroll
   * para llegar al boton de guardar.
   */
  tab: "conexion" | "correo" | "auditoria" = "conexion";

  /** El backend devuelve los ultimos 200 movimientos; se paginan en cliente. */
  readonly pagAudit = new Paginacion<GraphAuditItem>(() => this.audit, 15);

  readonly tabs = [
    { id: "conexion" as const, label: "Conexión", icon: "fa-solid fa-key" },
    { id: "correo" as const, label: "Correo", icon: "fa-solid fa-envelope" },
    {
      id: "auditoria" as const,
      label: "Auditoría",
      icon: "fa-solid fa-triangle-exclamation",
    },
  ];

  isLoading = false;
  isTesting = false;
  isSaving = false;
  showSecret = false;
  replaceSecret = false;
  testResult: { success: boolean; message: string } | null = null;
  emailTestResult: { success: boolean; message: string } | null = null;
  isEmailTesting = false;
  isSummarySending = false;
  summaryResult: DailySummaryResponse | null = null;

  syncIntervals = [
    { value: 60, label: "Cada 1 hora" },
    { value: 360, label: "Cada 6 horas" },
    { value: 720, label: "Cada 12 horas" },
    { value: 1440, label: "Cada 24 horas" },
    { value: 2880, label: "Cada 48 horas" },
    { value: 10080, label: "Cada 7 días" },
  ];

  get syncIntervalOptions(): { value: number; label: string }[] {
    const current = this.form?.get("syncIntervalMinutes")?.value as number;
    if (current && !this.syncIntervals.some((i) => i.value === current)) {
      return [
        ...this.syncIntervals,
        { value: current, label: `Cada ${current} minutos` },
      ];
    }
    return this.syncIntervals;
  }

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group({
      tenantId: ["", [Validators.required]],
      clientId: ["", [Validators.required]],
      clientSecret: [""],
      scope: ["https://graph.microsoft.com/.default", [Validators.required]],
      grantType: ["client_credentials", [Validators.required]],
      secretExpiresAt: [null],
      enabled: [false],
      syncIntervalMinutes: [1440, [Validators.min(5)]],
      mailEnabled: [false],
      mailFromAccount: ["", [Validators.email]],
      emailTestTo: ["", [Validators.email]],
    });
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  get statusInfo(): { label: string; className: string; icon: string } {
    const status = this.config?.status ?? "DISABLED";
    switch (status) {
      case "CONNECTED":
        return {
          label: "Conectado",
          className: "badge-success text-success-content",
          icon: "fa-solid fa-circle-check",
        };
      case "INCOMPLETE":
        return {
          label: "Configuración incompleta",
          className: "badge-warning text-warning-content",
          icon: "fa-solid fa-triangle-exclamation",
        };
      default:
        return {
          label: "Deshabilitado",
          className: "badge-ghost text-base-content/70",
          icon: "fa-solid fa-circle-xmark",
        };
    }
  }

  loadConfig(): void {
    this.isLoading = true;
    this.adminService
      .getMicrosoftGraphConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: MicrosoftGraphConfigResponse) => {
          this.config = config;
          this.form.patchValue({
            tenantId: config.tenantId || "",
            clientId: config.clientId || "",
            clientSecret: "",
            scope: config.scope || "https://graph.microsoft.com/.default",
            grantType: config.grantType || "client_credentials",
            secretExpiresAt: config.secretExpiresAt
              ? config.secretExpiresAt.slice(0, 10)
              : "",
            enabled: !!config.enabled,
            syncIntervalMinutes: config.syncIntervalMinutes || 1440,
            mailEnabled: !!config.mailEnabled,
            mailFromAccount: config.mailFromAccount || "",
          });
          this.isLoading = false;
          this.loadAudit();
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error cargando configuración Microsoft Graph", err);
          this.isLoading = false;
          this.toastService.error(
            "No se pudo cargar la configuración de Microsoft Graph",
          );
        },
      });
  }

  loadAudit(): void {
    this.adminService
      .getMicrosoftGraphAudit()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: GraphAuditItem[]) => {
          this.audit = items;
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error cargando auditoría Microsoft Graph", err);
        },
      });
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.warn("Complete los campos requeridos");
      return;
    }

    const raw = this.form.value;
    const payload: MicrosoftGraphConfigAdmin = {
      tenantId: raw.tenantId || undefined,
      clientId: raw.clientId || undefined,
      clientSecret: raw.clientSecret || undefined,
      scope: raw.scope || undefined,
      grantType: raw.grantType || undefined,
      enabled: !!raw.enabled,
      syncIntervalMinutes: raw.syncIntervalMinutes,
      secretExpiresAt: raw.secretExpiresAt
        ? new Date(raw.secretExpiresAt + "T23:59:59").toISOString()
        : null,
      mailEnabled: !!raw.mailEnabled,
      mailFromAccount: raw.mailFromAccount || undefined,
    };

    this.isSaving = true;
    this.adminService
      .updateMicrosoftGraphConfig(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config: MicrosoftGraphConfigResponse) => {
          this.config = config;
          this.form.patchValue({
            clientSecret: "",
            secretExpiresAt: config.secretExpiresAt
              ? config.secretExpiresAt.slice(0, 10)
              : "",
          });
          this.isSaving = false;
          this.loadAudit();
          this.toastService.success("Configuración guardada");
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error guardando configuración Microsoft Graph", err);
          this.isSaving = false;
          this.toastService.error(
            err?.error?.message || "No se pudo guardar la configuración",
          );
        },
      });
  }

  testConnection(): void {
    this.isTesting = true;
    this.testResult = null;
    this.adminService
      .testMicrosoftGraph()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: { success: boolean; message: string }) => {
          this.testResult = result;
          this.isTesting = false;
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error en prueba Microsoft Graph", err);
          this.testResult = {
            success: false,
            message: err?.error?.message || err?.message || "Error desconocido",
          };
          this.isTesting = false;
        },
      });
  }

  testEmail(): void {
    this.isEmailTesting = true;
    this.emailTestResult = null;
    const to =
      (this.form.get("emailTestTo")?.value as string)?.trim() || undefined;
    this.adminService
      .testMicrosoftGraphEmail(to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: { success: boolean; message: string }) => {
          this.emailTestResult = result;
          this.isEmailTesting = false;
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error en prueba de email Microsoft Graph", err);
          this.emailTestResult = {
            success: false,
            message: err?.error?.message || err?.message || "Error desconocido",
          };
          this.isEmailTesting = false;
        },
      });
  }

  toggleReplace(checked: boolean): void {
    this.replaceSecret = checked;
    if (checked) {
      this.form.patchValue({ clientSecret: "" });
    }
  }

  sendDailySummary(): void {
    this.isSummarySending = true;
    this.summaryResult = null;
    this.adminService
      .sendDailySummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: DailySummaryResponse) => {
          this.summaryResult = result;
          this.isSummarySending = false;
          if (result.sent > 0) {
            this.toastService.success(
              `Resumen enviado a ${result.sent} destinatario(s)`,
            );
          } else {
            this.toastService.warn(
              "No hay destinatarios configurados para el resumen",
            );
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error("Error enviando resumen diario", err);
          this.isSummarySending = false;
          this.toastService.error(
            err?.error?.message || "No se pudo enviar el resumen diario",
          );
        },
      });
  }
}

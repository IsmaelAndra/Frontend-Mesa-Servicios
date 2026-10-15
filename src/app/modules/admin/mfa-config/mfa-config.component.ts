import { Component, OnInit } from "@angular/core";
import {
  AdminService,
  MfaSettingAdmin,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";

/**
 * Interruptor del doble factor, para el super administrador.
 *
 * <p>Se pone en su propia pantalla y no dentro de seguridad porque el aviso que
 * importa aquí es de gente: antes de activar hay que saber a cuántos les va a
 * cambiar el acceso de golpe. Con 40 cuentas sin app, activarlo un viernes por la
 * tarde significa 40 personas fuera de lunes a primera hora, cada una con que
 * pedirle a soporte que le reinicie la cuenta.
 *pedir ayuda a soporte..
 */
@Component({
  selector: "app-mfa-config",
  standalone: false,
  templateUrl: "./mfa-config.component.html",
})
export class MfaConfigComponent implements OnInit {
  config: MfaSettingAdmin = {
    mfaEnabled: false,
    issuer: "Mesa de Servicios",
    enrolledCount: 0,
    superAdminEnrolled: false,
  };

  loading = false;
  guardando = false;
  /** Confirmación pendiente: activar cambia el login de todo el mundo. */
  confirmando = false;

  private configOriginal: MfaSettingAdmin = { ...this.config };

  /** Nombres cortos y reconocibles para la app autenticadora. */
  readonly nombresSugeridos = ['Mesa de Servicios COAC', 'COAC Magisterio', 'Mesa de Ayuda COAC'];

  constructor(
    private adminService: AdminService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.adminService.getMfaSetting().subscribe({
      next: (c) => {
        this.config = c;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(
          err?.error?.message || "No se pudo leer la configuración",
        );
      },
    });
  }

  /** Cuentas de la organización que aún no tienen app. */
  get sinEnrolarEstimadas(): number {
    return this.config.enrolledCount;
  }

  pedirCambio(): void {
    if (this.config.mfaEnabled) {
      // Desactivar es siempre seguro: nadie pierde nada.
      this.guardar();
      return;
    }
    // Activar sí tiene consecuencias, así que se pide confirmación explícita.
    this.confirmando = true;
  }

  cancelar(): void {
    this.confirmando = false;
  }

  confirmar(): void {
    this.confirmando = false;
    this.guardar();
  }

  private guardar(): void {
    this.guardando = true;
    this.adminService
      .updateMfaSetting({
        mfaEnabled: this.config.mfaEnabled,
        issuer: this.config.issuer,
      })
      .subscribe({
        next: (c) => {
          this.config = c;
          this.configOriginal = JSON.parse(JSON.stringify(c));
          this.guardando = false;
          if (!c.mfaEnabled) {
            this.toast.success("Doble factor desactivado.");
            return;
          }
          // Si la cuenta de quien activa esto no tiene app todavía, su próximo
          // acceso le va a pedir configurarla. Avisarlo ahora evita que se entere
          // justo cuando ya no puede entrar, porque ese mismo acceso es el que
          // exige el código.
          this.toast.success(
            c.superAdminEnrolled
              ? "Doble factor activado. Los usuarios sin app lo configurarán en su próximo acceso."
              : "Doble factor activado. En su próximo acceso verá el QR y sus códigos de recuperación: anótelos.",
            c.superAdminEnrolled ? "Listo" : "Atención",
          );
        },
        error: (err) => {
          this.guardando = false;
          this.toast.error(err?.error?.message || "No se pudo guardar");
        },
      });
  }

  /** Hay cambios pendientes respecto a lo ultimo guardado. */
  huboCambios(): boolean {
    return (
      this.config.mfaEnabled !== this.configOriginal.mfaEnabled ||
      this.config.issuer !== this.configOriginal.issuer
    );
  }

  /** Vuelve a leer del backend y descarta cambios locales. */
  descartar(): void {
    this.cargar();
  }
}

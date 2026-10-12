import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { AdminService } from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";

/**
 * Quien puede ver los acuses de lectura del chat.
 *
 * <p>El ajuste va al backend y de ahi se aplica a la respuesta de los mensajes:
 * si esta restringido, el servidor no manda los nombres ni el recuento, y no
 * basta con esconderlos en la pantalla. Por eso esta pantalla no le da al
 * administrador la sensacion de que "esta oculto pero se puede ver".
 *
 * <p>Lo que este ajuste NO hace es dejar de guardar las marcas de lectura. Se
 * siguen guardando siempre, de forma que si luego se amplia la visibilidad no
 * hay que reconstruir nada del historico.
 */
@Component({
  selector: "app-chat-config",
  templateUrl: "./chat-config.component.html",
})
export class ChatConfigComponent implements OnInit {
  form: FormGroup;
  isLoading = true;
  isSaving = false;

  /** Las opciones las devuelve el backend; esta es la de respaldo. */
  opciones: { valor: string; texto: string }[] = [];

  /** Descripcion de lo que hace la opcion elegida, para la vista previa. */
  private readonly explicaciones: Record<string, string> = {
    TODOS:
      "Cualquier persona con acceso al ticket ve si su mensaje ya fue leido y por quien. Es lo mas " +
      "cercano a WhatsApp, donde el solicitante ve el doble check azul.",
    TODOS_EXCEPTO_USUARIOS:
      "El personal (super administrador, administradores y agentes) ve los acuses, pero el usuario " +
      "final no: solo ve que su mensaje salio, sin saber si ya lo abrieron.",
    PERSONAL:
      "Igual que la anterior. Se conserva por separado para poder distinguirlas en el futuro.",
    ADMIN:
      "Solo los administradores ven los acuses. Ni los agentes ni los usuarios finales los ven, " +
      "aunque participen en el ticket.",
    SUPER_ADMIN:
      "Solo el super administrador ve los acuses. Es la opción más restrictiva y sirve para auditar " +
      "en silencio.",
    AGENTES:
      "Solo los agentes ven los acuses. Los administradores y los usuarios finales no.",
  };

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private toastService: ToastService,
  ) {
    this.form = this.fb.group({
      readVisibleTo: ["TODOS_EXCEPTO_USUARIOS", Validators.required],
      showReadByNames: [true],
    });
  }

  /**
   * Si tiene sentido tocar el interruptor de nombres. Con "solo el super
   * administrador" el interruptor no hace nada: ese unico lector ya puede ver
   * todo, asi que se oculta para no prometer un control que no existe.
   */
  get puedeElegirNombres(): boolean {
    return this.form.get("readVisibleTo")?.value !== "SUPER_ADMIN";
  }

  /** Texto de ayuda de la opcion seleccionada. */
  get explicacion(): string {
    const valor = this.form.get("readVisibleTo")?.value;
    return this.explicaciones[valor] || "";
  }

  ngOnInit(): void {
    this.adminService
      .getChatConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.opciones = cfg.options ?? [];
          this.form.patchValue({
            readVisibleTo: cfg.readVisibleTo,
            showReadByNames: cfg.showReadByNames,
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toastService.error(
            "No se pudo cargar la configuración del chat",
          );
        },
      });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { readVisibleTo, showReadByNames } = this.form.value;

    this.isSaving = true;
    this.adminService
      .updateChatConfig({ readVisibleTo, showReadByNames })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.success(
            "Visibilidad de los acuses de lectura actualizada",
          );
        },
        error: (err) => {
          this.isSaving = false;
          const mensaje =
            err?.error?.message || "No se pudo guardar la configuración";
          this.toastService.error(mensaje);
        },
      });
  }

  // ============ Badge de estado del header ============
  get badgeVisible(): { label: string; className: string; icon: string } {
    const valor = this.form?.get("readVisibleTo")?.value;
    if (!valor) {
      return {
        label: "Sin configurar",
        className: "badge-ghost text-base-content/70",
        icon: "fa-solid fa-circle-question",
      };
    }

    switch (valor) {
      case "TODOS":
        return {
          label: "Visible para todos",
          className: "badge-success text-success-content",
          icon: "fa-solid fa-users",
        };
      case "TODOS_EXCEPTO_USUARIOS":
      case "PERSONAL":
        return {
          label: "Solo personal",
          className: "badge-primary text-primary-content",
          icon: "fa-solid fa-user-shield",
        };
      case "ADMIN":
        return {
          label: "Solo administradores",
          className: "badge-warning text-warning-content",
          icon: "fa-solid fa-user-tie",
        };
      case "SUPER_ADMIN":
        return {
          label: "Solo super admin",
          className: "badge-error text-error-content",
          icon: "fa-solid fa-crown",
        };
      case "AGENTES":
        return {
          label: "Solo agentes",
          className: "badge-info text-info-content",
          icon: "fa-solid fa-crosshairs",
        };
      default:
        return {
          label: valor,
          className: "badge-ghost",
          icon: "fa-solid fa-circle",
        };
    }
  }

  // ============ Badge de alcance por opción ============
  alcanceBadge(valor: string): {
    label: string;
    className: string;
    icon: string;
  } {
    switch (valor) {
      case "TODOS":
        return {
          label: "Máxima visibilidad",
          className: "badge-success text-success-content",
          icon: "fa-solid fa-users",
        };
      case "TODOS_EXCEPTO_USUARIOS":
      case "PERSONAL":
        return {
          label: "Personal",
          className: "badge-primary text-primary-content",
          icon: "fa-solid fa-user-shield",
        };
      case "ADMIN":
        return {
          label: "Admin",
          className: "badge-warning text-warning-content",
          icon: "fa-solid fa-user-tie",
        };
      case "SUPER_ADMIN":
        return {
          label: "Restringido",
          className: "badge-error text-error-content",
          icon: "fa-solid fa-lock",
        };
      case "AGENTES":
        return {
          label: "Agentes",
          className: "badge-info text-info-content",
          icon: "fa-solid fa-crosshairs",
        };
      default:
        return {
          label: valor,
          className: "badge-ghost",
          icon: "fa-solid fa-circle",
        };
    }
  }

  // ============ Explicación por opción ============
  explicacionDe(valor: string): string {
    return this.explicaciones[valor] || "";
  }

  // ============ Label legible del valor actual ============
  labelVisible(): string {
    const valor = this.form?.get("readVisibleTo")?.value;
    const opcion = this.opciones.find((o) => o.valor === valor);
    return opcion?.texto || "Sin configurar";
  }

  // ============ Preview del acuse ============
  previewAcuse(): { texto: string; className: string; icon: string } {
    const visible = this.form?.get("readVisibleTo")?.value;
    const mostrarNombres = this.form?.get("showReadByNames")?.value;

    switch (visible) {
      case "TODOS":
        return {
          texto: mostrarNombres
            ? "Leído por Juan, María y 2 más"
            : "Leído por 4 personas",
          className: "text-info",
          icon: "fa-solid fa-check-double",
        };
      case "TODOS_EXCEPTO_USUARIOS":
      case "PERSONAL":
        return {
          texto: mostrarNombres ? "Leído por agentes" : "Leído por el personal",
          className: "text-info",
          icon: "fa-solid fa-check-double",
        };
      case "ADMIN":
        return {
          texto: mostrarNombres
            ? "Leído por administradores"
            : "Leído por admins",
          className: "text-warning",
          icon: "fa-solid fa-check-double",
        };
      case "SUPER_ADMIN":
        return {
          texto: "Solo visible para super admin",
          className: "text-error",
          icon: "fa-solid fa-lock",
        };
      case "AGENTES":
        return {
          texto: mostrarNombres ? "Leído por 2 agentes" : "Leído por agentes",
          className: "text-primary",
          icon: "fa-solid fa-check-double",
        };
      default:
        return {
          texto: "Sin acuse",
          className: "text-base-content/40",
          icon: "fa-solid fa-check",
        };
    }
  }

  // ============ Descartar cambios ============
  cancelar(): void {
    if (this.isSaving) return;
    this.isLoading = true;
    this.adminService
      .getChatConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cfg) => {
          this.opciones = cfg.options ?? [];
          this.form.patchValue({
            readVisibleTo: cfg.readVisibleTo,
            showReadByNames: cfg.showReadByNames,
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toastService.error("No se pudo recargar la configuración");
        },
      });
  }
}

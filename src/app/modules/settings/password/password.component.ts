import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";
import { ToastService } from "../../../core/services/toast.service";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

interface StrengthResult {
  /** Puntaje de 0 a 4 */
  score: number;
  /** Porcentaje visual (0, 25, 50, 75, 100) */
  percent: number;
  /** Etiqueta legible: "Débil", "Fuerte", etc. */
  label: string;
  /** Clase Tailwind para el fondo de la barra */
  colorClass: string;
  /** Clase Tailwind para el texto */
  textClass: string;
}

/** Requisito individual de la contraseña */
interface PasswordRequirement {
  id: string;
  label: string;
  /** Función pura que evalúa si el requisito se cumple */
  test: (pwd: string) => boolean;
}

// ─────────────────────────────────────────────────────────────
// Constantes (evitan recrear objetos en cada ciclo)
// ─────────────────────────────────────────────────────────────

const STRENGTH_MAP: ReadonlyArray<Omit<StrengthResult, "score">> = [
  { percent: 0,   label: "Muy débil", colorClass: "bg-error",   textClass: "text-error"   },
  { percent: 25,  label: "Débil",     colorClass: "bg-error",   textClass: "text-error"   },
  { percent: 50,  label: "Aceptable", colorClass: "bg-warning", textClass: "text-warning" },
  { percent: 75,  label: "Fuerte",    colorClass: "bg-info",    textClass: "text-info"    },
  { percent: 100, label: "Muy fuerte", colorClass: "bg-success", textClass: "text-success" },
];

const REQUIREMENTS: ReadonlyArray<PasswordRequirement> = [
  { id: "length",    label: "Mínimo 8 caracteres",      test: (p) => p.length >= 8 },
  { id: "case",      label: "Mayúsculas y minúsculas",  test: (p) => /[A-Z]/.test(p) && /[a-z]/.test(p) },
  { id: "digit",     label: "Al menos un número",       test: (p) => /\d/.test(p) },
  { id: "symbol",    label: "Un símbolo especial",      test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const MIN_PASSWORD_LENGTH = 8;

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

@Component({
  selector: "app-password",
  templateUrl: "./password.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPasswordComponent {
  // ─── Dependencias (usando inject() en lugar de constructor) ───
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  // ─── Estado del formulario ───
  readonly currentPassword = signal("");
  readonly newPassword = signal("");
  readonly confirmPassword = signal("");
  readonly loading = signal(false);
  /** La cuenta tiene doble factor: el cambio se confirma con el código de la app. */
  readonly pideCodigoMfa = signal(false);
  readonly codigoMfa = signal("");

  constructor() {
    this.authService.pideCodigoMfa?.().subscribe((pide) => this.pideCodigoMfa.set(pide));
  }
  readonly submitted = signal(false);

  // ─── Visibilidad de contraseñas ───
  readonly showCurrent = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  // ─── Requisitos expuestos al template ───
  readonly requirements = REQUIREMENTS;

  // ─── Cálculos derivados ───

  /** ¿La confirmación coincide con la nueva contraseña? */
  readonly passwordsMatch = computed(() => {
    const confirm = this.confirmPassword();
    return confirm.length > 0 && confirm === this.newPassword();
  });

  /** ¿La nueva contraseña es distinta a la actual? */
  readonly isNewPasswordDifferent = computed(() => {
    const newPwd = this.newPassword();
    return newPwd.length > 0 && newPwd !== this.currentPassword();
  });

  /** Resultado completo de fortaleza */
  readonly strength = computed<StrengthResult>(() =>
    this.calculateStrength(this.newPassword())
  );

  /** ¿Se puede enviar el formulario? */
  readonly canSubmit = computed(() => {
    return (
      !this.loading() &&
      this.currentPassword().length > 0 &&
      this.newPassword().length >= MIN_PASSWORD_LENGTH &&
      this.passwordsMatch() &&
      this.isNewPasswordDifferent() &&
      (!this.pideCodigoMfa() || /^[0-9]{6}$/.test(this.codigoMfa().trim()))
    );
  });

  // ─── Atajos para el template (evitan llamar funciones) ───

  /** Devuelve true si el requisito indicado se cumple */
  meetsRequirement(req: PasswordRequirement): boolean {
    return req.test(this.newPassword());
  }

  // ─── Fortaleza de contraseña ───

  private calculateStrength(password: string): StrengthResult {
    if (!password) {
      return {
        score: 0,
        percent: 0,
        label: "",
        colorClass: "bg-base-300",
        textClass: "opacity-60",
      };
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    score = Math.min(score, 4);

    return { score, ...STRENGTH_MAP[score] };
  }

  // ─── Toggle visibilidad ───

  toggleCurrent(): void { this.showCurrent.update((v) => !v); }
  toggleNew(): void     { this.showNew.update((v) => !v); }
  toggleConfirm(): void { this.showConfirm.update((v) => !v); }

  // ─── Reset ───

  private resetForm(): void {
    this.currentPassword.set("");
    this.newPassword.set("");
    this.confirmPassword.set("");
    this.codigoMfa.set("");
    this.showCurrent.set(false);
    this.showNew.set(false);
    this.showConfirm.set(false);
    this.submitted.set(false);
  }

  // ─── Submit ───

  changePassword(): void {
    this.submitted.set(true);

    const current = this.currentPassword();
    const newPwd = this.newPassword();
    const confirm = this.confirmPassword();

    // Validaciones (mismo orden que el template para coherencia UX)
    if (!current || !newPwd || !confirm) {
      this.toastService.warn("Complete todos los campos");
      return;
    }
    if (!this.passwordsMatch()) {
      this.toastService.error("Las contraseñas no coinciden");
      return;
    }
    if (newPwd.length < MIN_PASSWORD_LENGTH) {
      this.toastService.error(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
      );
      return;
    }
    if (!this.isNewPasswordDifferent()) {
      this.toastService.warn("La nueva contraseña debe ser diferente a la actual");
      return;
    }

    this.loading.set(true);

    this.authService.changePassword(current, newPwd, this.codigoMfa().trim() || undefined).subscribe({
      next: () => {
        this.loading.set(false);
        this.authService.clearMustChangePassword();
        this.resetForm();
        this.toastService.success("Tu contraseña ha sido actualizada correctamente");
        this.router.navigate(["/dashboard"]);
      },
      error: (e: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.toastService.error(
          e?.error?.message || "No se pudo cambiar la contraseña"
        );
      },
    });
  }

  // ─── Helpers de template ───

  trackByRequirement(_: number, item: PasswordRequirement): string {
    return item.id;
  }
}
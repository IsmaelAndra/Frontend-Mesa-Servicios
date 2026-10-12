import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import {
  AdminService,
  AiConfigAdmin,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";

@Component({
  selector: "app-ai-config",
  templateUrl: "./ai-config.component.html",
})
export class AiConfigComponent implements OnInit {
  aiForm: FormGroup;
  isLoading = false;
  showApiKey = false;
  /** Si hay clave configurada. El backend no la devuelve ni enmascarada. */
  apiKeyConfigured = false;

  readonly providers = [
    "GEMINI",
    "OPENAI",
    "AZURE_OPENAI",
    "ANTHROPIC",
    "OLLAMA",
  ];

  readonly providerDefaults: {
    [k: string]: { model: string; baseUrl: string };
  } = {
    GEMINI: {
      model: "gemini-3.6-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    },
    OPENAI: { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
    AZURE_OPENAI: { model: "gpt-4o-mini", baseUrl: "" },
    ANTHROPIC: {
      model: "claude-3-5-haiku-latest",
      baseUrl: "https://api.anthropic.com/v1",
    },
    OLLAMA: { model: "llama3.1", baseUrl: "http://localhost:11434/v1" },
  };

  readonly providerIcons: { [k: string]: string } = {
    GEMINI: "✨",
    OPENAI: "◎",
    AZURE_OPENAI: "☁",
    ANTHROPIC: "✦",
    OLLAMA: "🐪",
  };

  private destroyRef = inject(DestroyRef);

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private toastService: ToastService,
  ) {
    this.aiForm = this.fb.group({
      enabled: [false],
      provider: ["OPENAI", [Validators.required]],
      model: ["gpt-4o-mini", [Validators.required]],
      apiKey: [""],
      baseUrl: [""],
      providerIcon: [""],
      rulesText: [""],
      enabledActions: ["SUMMARY,ANSWER"],
    });
  }

  /** Acciones que el administrador puede encender o apagar. */
  readonly accionesIa = [
    {
      value: "SUMMARY",
      label: "Resumir ticket",
      ayuda: "Genera el resumen ejecutivo al abrir un ticket.",
    },
    {
      value: "ANSWER",
      label: "Sugerir respuesta",
      ayuda: "Propone la respuesta del agente al solicitante.",
    },
    {
      value: "CHAT",
      label: "Chat del asistente",
      ayuda: "El botón flotante de ayuda con el usuario.",
    },
    {
      value: "CLASSIFY",
      label: "Clasificar tickets (automatizaciones)",
      ayuda: "Lo usa el nodo NEXA de los workflows para sugerir prioridad, categoría y equipo.",
    },
  ];

  /** Caracteres escritos en el campo de reglas, para el contador de la etiqueta. */
  reglasLongitud(): number {
    return String(this.aiForm.get("rulesText")?.value || "").length;
  }

  accionesSeleccionadas(): string[] {
    const bruto = this.aiForm.get("enabledActions")?.value || "";
    return String(bruto)
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  alternarAccion(valor: string): void {
    const actuales = this.accionesSeleccionadas();
    const siguiente = actuales.includes(valor)
      ? actuales.filter((v) => v !== valor)
      : [...actuales, valor];
    this.aiForm.patchValue({ enabledActions: siguiente.join(",") });
  }

  accionActiva(valor: string): boolean {
    return this.accionesSeleccionadas().includes(valor);
  }

  /** Texto de arranque para quien no sepa por dónde empezar. */
  readonly borradorReglas = [
    "- Responde siempre en español de Ecuador, con tono formal pero cercano.",
    "- No inventes datos: si no están en el ticket, indica qué debe consultar el agente.",
    "- Nunca prometas plazos ni resultados que no estén en el SLA del ticket.",
    "- Redacta respuestas de máximo 200 palabras, en Markdown.",
    "- Si te piden datos personales o credenciales, indica que se consulten en el módulo correspondiente.",
    "- Al clasificar (nodo NEXA): responde SOLO un objeto JSON, sin texto alrededor.",
    "- En la clasificación usa SOLO los valores permitidos listados en el prompt (prioridad, categoría y equipo); si no puedes decidir, pon null en esa clave.",
    "- Devuelve una confianza de 0 a 1 y sea austero: confianza baja o ticket sin datos se marcan como no decidido.",
  ].join("\n");

  iconPreview(): string {
    return (this.aiForm.get("providerIcon")?.value || "").trim();
  }

  isUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  isFa(value: string): boolean {
    const v = (value || "").trim();
    return !this.isUrl(v) && v.includes("fa-");
  }

  iconError(): void {
    this.aiForm.patchValue({ providerIcon: "" }, { emitEvent: false });
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    this.isLoading = true;
    this.adminService
      .getAiConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.apiKeyConfigured = config.apiKeyConfigured;
          this.aiForm.patchValue({
            enabled: config.enabled,
            provider: config.provider,
            model: config.model,
            baseUrl: config.baseUrl,
            providerIcon: config.providerIcon || "",
            apiKey: "",
            rulesText: config.rulesText || "",
            enabledActions: config.enabledActions || "SUMMARY,ANSWER",
          });
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toastService.error("No se pudo cargar la configuración de IA");
        },
      });
  }

  onProviderChange(): void {
    const provider = this.aiForm.get("provider")?.value;
    const defaults = this.providerDefaults[provider];
    if (defaults) {
      this.aiForm.patchValue(
        { model: defaults.model, baseUrl: defaults.baseUrl },
        { emitEvent: false },
      );
    }
    const icon = this.providerIcons[provider];
    if (icon) {
      this.aiForm.patchValue({ providerIcon: icon }, { emitEvent: false });
    }
  }

  onSave(): void {
    if (this.aiForm.invalid) {
      this.aiForm.markAllAsTouched();
      this.toastService.warn("Complete los campos requeridos");
      return;
    }

    this.isLoading = true;
    const payload = this.aiForm.value as AiConfigAdmin;
    this.adminService
      .updateAiConfig(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.toastService.success("Configuración guardada");
          this.loadConfig();
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          // Sin mensaje del backend solo se muestrava "no se pudo guardar", que
          // no dice si fue un 403 por rol, un 400 de validacion o un 500. Con el
          // codigo al menos se puede distinguir sin adivinar.
          const mensaje = err?.error?.message;
          if (mensaje) {
            this.toastService.error(mensaje);
            return;
          }
          const estado = err?.status;
          if (estado === 403) {
            this.toastService.error(
              "No tiene permisos: solo el SUPER_ADMIN puede guardar la configuración de IA",
            );
          } else if (estado === 400) {
            this.toastService.error("El backend rechazó los datos (revise proveedor y modelo)");
          } else {
            this.toastService.error(
              `No se pudo guardar la configuración (error ${estado ?? "sin código"})`,
            );
          }
        },
      });
  }

  readonly iconosSugeridos: { value: string; label: string }[] = [
    { value: "fa-solid fa-robot", label: "Robot" },
    { value: "fa-solid fa-wand-magic-sparkles", label: "Mágico" },
    { value: "fa-solid fa-comment-dots", label: "Chat" },
    { value: "fa-solid fa-brain", label: "Cerebro" },
    { value: "fa-solid fa-sparkles", label: "Destellos" },
    { value: "fa-solid fa-lightbulb", label: "Idea" },
  ];
}

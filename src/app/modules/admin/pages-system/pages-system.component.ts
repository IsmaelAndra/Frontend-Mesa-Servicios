import { Component, OnInit } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import {
  AdminService,
  BrandingConfig,
  ErrorPageTexts,
  PrivacyPolicy,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";
import {
  resolveErrorPage,
  ErrorStatus,
  ERROR_STATUSES,
} from "../../../core/utils/error-page.util";
import { markdownToHtml } from "../../../core/utils/markdown.util";
import { urlDelApi } from '../../../core/utils/url-api.util';

type TabId = "mantenimiento" | "404" | "403" | "500" | "503" | "privacidad";

/** Valores de tab que el usuario puede activar (etiquetas de estado incluidas). */
const TABS_VALIDOS: TabId[] = ["mantenimiento", "404", "403", "500", "503", "privacidad"];

/**
 * Un estado de error en la pantalla de edicion.
 * Mismo shape que usaba PagesConfigComponent, para no romper el contrato.
 */
interface EstadoEditable {
  status: ErrorStatus;
  etiqueta: string;
  ayuda: string;
  claveTitulo: keyof ErrorPageTexts;
  claveMensaje: keyof ErrorPageTexts;
  claveIcono: keyof ErrorPageTexts;
  claveColor: keyof ErrorPageTexts;
  titulo: string;
  mensaje: string;
  icono: string;
  color: string;
}

/**
 * Pantalla unica "Paginas del sistema".
 *
 * Reune en tabs lo que antes eran dos pantallas separadas: el modo
 * mantenimiento y los textos de error + politica de privacidad.
 *
 * El logo es compartido por los cinco tabs de aviso: cuando se cae el
 * backend, las imagenes que dependen de la API se pierden, asi que tiene
 * que haber uno solo cacheado y reutilizado por todas las pantallas.
 * La ETA solo aplica a mantenimiento, que es el unico aviso planificado.
 */
@Component({
  selector: "app-pages-system",
  templateUrl: "./pages-system.component.html",
  styleUrls: ["./pages-system.component.css"],
  standalone: false,
})
export class PagesSystemComponent implements OnInit {
  tab: TabId = "mantenimiento";

  loading = false;
  saving = false;
  uploadingLogo = false;
  logoFile: File | null = null;

  /** Branding completo: mantenimiento + logo + iconos. */
  config: BrandingConfig | null = null;
  private configOriginal: BrandingConfig | null = null;

  /** Estados de error editables. */
  estados: EstadoEditable[] = [];
  private estadosOriginal = "";

  /** Ajustes comunes a todas las páginas de aviso (botón, código, privacidad). */
  comunes = { errorButtonText: "Volver al inicio", errorShowCode: true, errorShowPrivacy: true };

  /** Política de privacidad. */
  privacidad: PrivacyPolicy = {
    privacyTitle: "Política de privacidad",
    privacyVersion: "1.0",
    privacyContent: "",
    privacyContact: "",
    privacyEffective: "",
    edited: false,
  };
  private privacidadOriginal = "";

  vistaPrevia: SafeHtml = "";

  /** Iconos sugeridos para las pantallas de aviso. */
  readonly iconosDisponibles: { value: string; label: string }[] = [
    { value: "fa-solid fa-screwdriver-wrench", label: "Herramienta" },
    { value: "fa-solid fa-triangle-exclamation", label: "Advertencia" },
    { value: "fa-solid fa-gear", label: "Engranaje" },
    { value: "fa-solid fa-clock", label: "Reloj" },
    { value: "fa-solid fa-plug-circle-xmark", label: "Sin conexion" },
    { value: "fa-solid fa-server", label: "Servidor" },
    { value: "fa-solid fa-cloud-arrow-down", label: "Nube" },
    { value: "fa-solid fa-bolt", label: "Rayo" },
    { value: "fa-solid fa-network-wired", label: "Red" },
    { value: "fa-solid fa-hammer", label: "Martillo" },
    { value: "fa-solid fa-compass", label: "Brújula" },
    { value: "fa-solid fa-lock", label: "Candado" },
    { value: "fa-solid fa-user-lock", label: "Usuario bloqueado" },
    { value: "fa-solid fa-bug", label: "Bug" },
    { value: "fa-solid fa-house", label: "Casa" },
  ];

  /** Paleta rapida para el icono. */
  readonly coloresDisponibles: { value: string; label: string }[] = [
    { value: "#d97706", label: "Ambar" },
    { value: "#dc2626", label: "Rojo" },
    { value: "#2563eb", label: "Azul" },
    { value: "#7c3aed", label: "Violeta" },
    { value: "#059669", label: "Verde" },
    { value: "#475569", label: "Gris" },
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  // ────────────────────────────────────────────────────────────────
  // CARGA
  // ────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;

    this.adminService.getBranding().subscribe({
      next: (b) => {
        this.config = b;
        this.configOriginal = JSON.parse(JSON.stringify(b));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastService.error("No se pudo cargar la configuración");
      },
    });

    this.adminService.getErrorTexts().subscribe({
      next: (t) => {
        this.estados = this.aEstados(t);
        this.comunes = this.aComunes(t);
        this.estadosOriginal = this.snapshotEstados();
      },
      error: () =>
        this.toastService.error("No se pudieron cargar los textos de error"),
    });

    this.adminService.getPrivacyPolicy().subscribe({
      next: (p) => {
        this.privacidad = { ...p };
        this.privacidadOriginal = JSON.stringify(this.privacidad);
        this.actualizarVistaPrevia();
      },
      error: () =>
        this.toastService.error("No se pudo cargar la política de privacidad"),
    });
  }

  // ────────────────────────────────────────────────────────────────
  // HELPERS DE ESTADO
  // ────────────────────────────────────────────────────────────────

  private aComunes(t: ErrorPageTexts) {
    return {
      errorButtonText: t.errorButtonText?.trim() || "Volver al inicio",
      errorShowCode: t.errorShowCode !== false,
      errorShowPrivacy: t.errorShowPrivacy !== false,
    };
  }

  private aEstados(t: ErrorPageTexts): EstadoEditable[] {
    return ERROR_STATUSES.map((status) => ({
      status,
      etiqueta: String(status),
      ayuda: this.ayudaDe(status),
      claveTitulo: `error${status}Title` as keyof ErrorPageTexts,
      claveMensaje: `error${status}Message` as keyof ErrorPageTexts,
      claveIcono: `error${status}Icon` as keyof ErrorPageTexts,
      claveColor: `error${status}Color` as keyof ErrorPageTexts,
      titulo: String(t[`error${status}Title`] ?? ""),
      mensaje: String(t[`error${status}Message`] ?? ""),
      icono: String(t[`error${status}Icon`] ?? ""),
      color: String(t[`error${status}Color`] ?? ""),
    }));
  }

  private ayudaDe(status: ErrorStatus): string {
    switch (status) {
      case 404:
        return "La ruta no existe. Aparece al escribir mal una dirección o al seguir un enlace viejo.";
      case 403:
        return "El usuario está identificado pero su rol no alcanza para esa sección.";
      case 500:
        return "Fallo del servidor. Es la que ve quien no puede cargar nada porque el backend esta caido.";
      case 503:
        return "El sistema esta fuera de servicio de forma prevista, normalmente por mantenimiento.";
    }
  }

  // ────────────────────────────────────────────────────────────────
  // GETTERS DE MANTENIMIENTO / AVISOS
  // ────────────────────────────────────────────────────────────────

  get titulo(): string {
    return this.config?.maintenanceTitle?.trim() || "Sistema en mantenimiento";
  }

  get mensaje(): string {
    return (
      this.config?.maintenanceMessage?.trim() ||
      "Estamos realizando mejoras en el sistema. Vuelve a intentar en unos minutos."
    );
  }

  get eta(): string {
    return this.config?.maintenanceEta?.trim() || "";
  }

  /** Logo compartido por las cinco pantallas de aviso. */
  get logo(): string {
    const url =
      this.config?.maintenanceLogoUrl ||
      this.config?.logoUrl ||
      this.config?.systemIconUrl ||
      "";
    return this.absoluta(url);
  }

  get colorIcono(): string {
    return this.config?.maintenanceIconColor?.trim() || "#d97706";
  }

  nombreIconoActual(): string {
    const actual = this.config?.maintenanceIcon;
    if (!actual) return "Herramienta (por defecto)";
    return (
      this.iconosDisponibles.find((i) => i.value === actual)?.label ??
      "Icono personalizado"
    );
  }

  private absoluta(url: string): string {
    if (!url) return "";
    return urlDelApi(url);
  }

  // ────────────────────────────────────────────────────────────────
  // ESTADO DEL TAB ACTIVO
  // ────────────────────────────────────────────────────────────────

  get tabActivoEsMantenimiento(): boolean {
    return this.tab === "mantenimiento";
  }

  get tabActivoEsError(): boolean {
    return this.tab !== "mantenimiento" && this.tab !== "privacidad";
  }

  get tabActivoEsPrivacidad(): boolean {
    return this.tab === "privacidad";
  }

  /** Devuelve el estado editable del tab activo, si es un error. */
  get estadoActivo(): EstadoEditable | undefined {
    if (!this.tabActivoEsError) return undefined;
    return this.estados.find((e) => e.etiqueta === this.tab);
  }

  /** Titulo/mensaje/icono/color que se muestran en la vista previa. */
  get previewTitulo(): string {
    if (this.tabActivoEsMantenimiento) return this.titulo;
    return this.estadoActivo?.titulo?.trim() || `Error ${this.tab}`;
  }

  get previewMensaje(): string {
    if (this.tabActivoEsMantenimiento) return this.mensaje;
    return (
      this.estadoActivo?.mensaje?.trim() ||
      "Ha ocurrido un problema. Intenta nuevamente en unos minutos."
    );
  }

  get previewIcono(): string {
    if (this.tabActivoEsMantenimiento) {
      return this.config?.maintenanceIcon || "fa-solid fa-screwdriver-wrench";
    }
    return this.estadoActivo?.icono?.trim() || "fa-solid fa-circle-question";
  }

  get previewColor(): string {
    if (this.tabActivoEsMantenimiento) return this.colorIcono;
    const c = this.estadoActivo?.color?.trim() || "";
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : "#64748b";
  }

  /** ETA solo se muestra en mantenimiento. */
  get previewEta(): string {
    return this.tabActivoEsMantenimiento ? this.eta : "";
  }

  // ────────────────────────────────────────────────────────────────
  // LOGO
  // ────────────────────────────────────────────────────────────────

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.logoFile = file;
    this.subirLogo();
  }

  subirLogo(): void {
    if (!this.logoFile) return;
    this.uploadingLogo = true;
    this.adminService.uploadMaintenanceLogo(this.logoFile).subscribe({
      next: (r) => {
        this.uploadingLogo = false;
        if (this.config) this.config.maintenanceLogoUrl = r.url;
        this.toastService.success("Logo de páginas del sistema actualizado");
      },
      // El servidor explica el motivo (formato no admitido, tamaño...): antes
      // se tapaba con un mensaje genérico y no había forma de saber qué pasaba.
      error: (e) => {
        this.uploadingLogo = false;
        this.toastService.error(e?.error?.message || "No se pudo subir el logo");
      },
    });
  }

  quitarLogo(): void {
    if (!this.config) return;
    this.config.maintenanceLogoUrl = "";
    this.toastService.info(
      "Se usara el logo del sistema. Guarda para aplicar.",
    );
  }

  // ────────────────────────────────────────────────────────────────
  // CAMBIO DE TAB
  // ────────────────────────────────────────────────────────────────

  cambiarTab(t: TabId | string): void {
    // La etiqueta de los estados de error (`"404"`, `"403"`, ...) llega como
    // string desde el HTML; se valida antes de escribirla en `this.tab`.
    const tab = TABS_VALIDOS.includes(t as TabId) ? (t as TabId) : this.tab;
    this.tab = tab;
  }

  // ────────────────────────────────────────────────────────────────
  // DETECCION DE CAMBIOS
  // ────────────────────────────────────────────────────────────────

  hayCambiosMantenimiento(): boolean {
    if (!this.config || !this.configOriginal) return false;
    // Solo comparamos los campos que mantenimiento controla, para no
    // disparar el aviso cuando otro tab cambio algo.
    return (
      this.config.maintenanceMode !== this.configOriginal.maintenanceMode ||
      this.config.maintenanceTitle !== this.configOriginal.maintenanceTitle ||
      this.config.maintenanceMessage !==
        this.configOriginal.maintenanceMessage ||
      this.config.maintenanceEta !== this.configOriginal.maintenanceEta ||
      this.config.maintenanceIcon !== this.configOriginal.maintenanceIcon ||
      this.config.maintenanceIconColor !==
        this.configOriginal.maintenanceIconColor
    );
  }

  private snapshotEstados(): string {
    return JSON.stringify(
      this.estados.map((e) => [
        e.status,
        e.titulo,
        e.mensaje,
        e.icono,
        e.color,
      ]).concat([[this.comunes.errorButtonText, this.comunes.errorShowCode, this.comunes.errorShowPrivacy] as never]),
    );
  }

  hayCambiosErrores(): boolean {
    return this.snapshotEstados() !== this.estadosOriginal;
  }

  hayCambiosPrivacidad(): boolean {
    return JSON.stringify(this.privacidad) !== this.privacidadOriginal;
  }

  /** Cambios pendientes del tab activo. */
  hayCambios(): boolean {
    if (this.tabActivoEsMantenimiento) return this.hayCambiosMantenimiento();
    if (this.tabActivoEsPrivacidad) return this.hayCambiosPrivacidad();
    return this.hayCambiosErrores();
  }

  // ────────────────────────────────────────────────────────────────
  // GUARDAR
  // ────────────────────────────────────────────────────────────────

  guardar(): void {
    if (this.tabActivoEsMantenimiento) return this.guardarMantenimiento();
    if (this.tabActivoEsPrivacidad) return this.guardarPrivacidad();
    return this.guardarErrores();
  }

  private guardarMantenimiento(): void {
    if (!this.config) return;
    this.saving = true;
    this.adminService.updateBranding(this.config).subscribe({
      next: (b) => {
        this.config = b;
        this.configOriginal = JSON.parse(JSON.stringify(b));
        this.saving = false;
        this.toastService.success("Configuración de mantenimiento actualizada");
      },
      error: () => {
        this.saving = false;
        this.toastService.error("No se pudo guardar");
      },
    });
  }

  private guardarErrores(): void {
    const incompletos = this.estados.filter(
      (e) => !e.titulo.trim() || !e.mensaje.trim(),
    );
    if (incompletos.length) {
      this.toastService.error(
        `Completa el título y el mensaje del ${incompletos
          .map((e) => e.etiqueta)
          .join(", ")}`,
      );
      return;
    }
    if (!this.hayCambiosErrores()) {
      this.toastService.info("No hay cambios que guardar");
      return;
    }

    this.saving = true;
    this.adminService.updateErrorTexts(this.aPayloadErrores()).subscribe({
      next: (t) => {
        this.estados = this.aEstados(t);
        this.comunes = this.aComunes(t);
        this.estadosOriginal = this.snapshotEstados();
        this.saving = false;
        this.toastService.success("Páginas de aviso guardadas");
      },
      error: (e) => {
        this.saving = false;
        this.toastService.error(
          e?.error?.message || "No se pudieron guardar los textos",
        );
      },
    });
  }

  /**
   * Quita la marca de borrador: elimina del texto el aviso "> **Borrador.**"
   * que trae la plantilla y guarda aunque no haya más cambios. Antes no había
   * forma de hacerlo sin tocar el texto, porque Guardar exige cambios.
   */
  publicarComoOficial(): void {
    const lineas = (this.privacidad.privacyContent || "").split("\n");
    const inicio = lineas.findIndex((l) => /^>\s*\**borrador/i.test(l.trim()));
    if (inicio >= 0) {
      let fin = inicio;
      while (fin < lineas.length && lineas[fin].trim().startsWith(">")) fin++;
      // También la línea en blanco que lo separaba del resto.
      if (fin < lineas.length && !lineas[fin].trim()) fin++;
      lineas.splice(inicio, fin - inicio);
      this.privacidad.privacyContent = lineas.join("\n");
      this.actualizarVistaPrevia();
    }
    this.guardarPrivacidad(true);
  }

  private guardarPrivacidad(forzar = false): void {
    if (!this.privacidad.privacyTitle.trim()) {
      this.toastService.error("El título de la política es obligatorio");
      return;
    }
    if (!forzar && !this.hayCambiosPrivacidad()) {
      this.toastService.info("No hay cambios que guardar");
      return;
    }

    this.saving = true;
    this.adminService
      .updatePrivacyPolicy({
        privacyTitle: this.privacidad.privacyTitle,
        privacyVersion: this.privacidad.privacyVersion,
        privacyContent: this.privacidad.privacyContent,
        privacyContact: this.privacidad.privacyContact,
        privacyEffective: this.privacidad.privacyEffective,
      })
      .subscribe({
        next: (p) => {
          this.privacidad = { ...p };
          this.privacidadOriginal = JSON.stringify(this.privacidad);
          this.saving = false;
          this.actualizarVistaPrevia();
          this.toastService.success(
            forzar ? "Política publicada como oficial" : "Política de privacidad guardada",
          );
        },
        error: (e) => {
          this.saving = false;
          this.toastService.error(
            e?.error?.message || "No se pudo guardar la política",
          );
        },
      });
  }

  private aPayloadErrores(): ErrorPageTexts {
    const out: Record<string, string | boolean> = {
      errorButtonText: this.comunes.errorButtonText.trim() || "Volver al inicio",
      errorShowCode: this.comunes.errorShowCode,
      errorShowPrivacy: this.comunes.errorShowPrivacy,
    };
    for (const e of this.estados) {
      out[e.claveTitulo] = e.titulo;
      out[e.claveMensaje] = e.mensaje;
      out[e.claveIcono] = e.icono;
      out[e.claveColor] = e.color;
    }
    return out as unknown as ErrorPageTexts;
  }

  volver(): void {
    this.logoFile = null;
    this.load();
  }

  // ────────────────────────────────────────────────────────────────
  // PRIVACIDAD
  // ────────────────────────────────────────────────────────────────

  actualizarVistaPrevia(): void {
    this.vistaPrevia = this.sanitizer.bypassSecurityTrustHtml(
      markdownToHtml(this.privacidad.privacyContent),
    );
  }

  resolver(e: EstadoEditable) {
    return resolveErrorPage(e.status, this.aPayloadErrores());
  }

  /** Icono que se está editando en el tab activo. */
  get iconoActivo(): string {
    if (this.tabActivoEsMantenimiento) {
      return this.config?.maintenanceIcon || "";
    }
    return this.estadoActivo?.icono || "";
  }

  setIconoActivo(v: string): void {
    if (this.tabActivoEsMantenimiento) {
      if (this.config) this.config.maintenanceIcon = v;
      return;
    }
    if (this.estadoActivo) this.estadoActivo.icono = v;
  }

  /** Color que se está editando en el tab activo. */
  get colorActivo(): string {
    if (this.tabActivoEsMantenimiento) return this.colorIcono;
    return this.estadoActivo?.color || "#64748b";
  }

  setColorActivo(v: string): void {
    if (this.tabActivoEsMantenimiento) {
      if (this.config) this.config.maintenanceIconColor = v;
      return;
    }
    if (this.estadoActivo) this.estadoActivo.color = v;
  }

  /** Icono del estado para la miniatura del tab y del form. */
  iconoDe(e: EstadoEditable): string {
    return e.icono || "fa-solid fa-circle-question";
  }

  /** Color validado del estado. */
  colorDe(e: EstadoEditable): string {
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(e.color.trim())
      ? e.color.trim()
      : "#64748b";
  }
}

import { Component, OnInit } from "@angular/core";
import { opcionAnimacion } from '../../../core/utils/opciones-select.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import {
  AdminService,
  BrandingConfig,
  ChatBackgroundMode,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";
import {
  applyBrandingTheme,
  setChatBackground,
} from "../../../core/utils/branding-theme.util";
import {
  LOADING_ANIMATIONS,
  LOADING_LOGO_EFFECTS,
  LoadingLogoEffect,
  LoadingMode,
  LoadingScreenView,
  LoadingTheme,
  loadingLogoEffectClass,
  resolveLoadingScreen,
} from "../../../core/utils/loading-screen.util";

@Component({
  selector: "app-branding",
  templateUrl: "./branding.component.html",
})
export class BrandingComponent implements OnInit {
  config: BrandingConfig = {
    logoUrl: "",
    backgroundUrl: "",
    logoLoginUrl: "",
    systemIconUrl: "",
    primaryColor: "#062e86",
    secondaryColor: "#ec9811",
  };
  loading = false;
  logoFile: File | null = null;
  logoPreview = "";
  backgroundFile: File | null = null;
  backgroundPreview = "";
  logoLoginFile: File | null = null;
  logoLoginPreview = "";
  systemIconFile: File | null = null;
  systemIconPreview = "";
  reportLogoFile: File | null = null;
  reportLogoPreview = "";
  profileCoverFile: File | null = null;
  profileCoverPreview = "";
  chatBackgroundLightFile: File | null = null;
  chatBackgroundLightPreview = "";
  chatBackgroundDarkFile: File | null = null;
  chatBackgroundDarkPreview = "";
  loadingImageFile: File | null = null;
  loadingImagePreview = "";

  // ================= PANTALLA DE CARGA =================

  /** Iconos Font Awesome para el centro del splash. */
  readonly loadingIconos: { value: string; label: string }[] = [
    { value: "fa-solid fa-coffee-bean", label: "Café" },
    { value: "fa-solid fa-headset", label: "Soporte" },
    { value: "fa-solid fa-life-ring", label: "Auxilio" },
    { value: "fa-solid fa-gear", label: "Engranaje" },
    { value: "fa-solid fa-bolt", label: "Rayo" },
    { value: "fa-solid fa-shield-halved", label: "Escudo" },
    { value: "fa-solid fa-building-columns", label: "Institución" },
    { value: "fa-solid fa-graduation-cap", label: "Capacitación" },
    { value: "fa-solid fa-clock", label: "Reloj" },
    { value: "fa-solid fa-cloud-arrow-down", label: "Nube" },
    { value: "fa-solid fa-network-wired", label: "Red" },
    { value: "fa-solid fa-inbox", label: "Bandeja" },
  ];

  readonly loadingModos: {
    value: LoadingMode;
    label: string;
    ayuda: string;
  }[] = [
    { value: "AUTO", label: "Automático", ayuda: "Usa el icono del sistema" },
    { value: "IMAGE", label: "Imagen", ayuda: "Usa la imagen que subas" },
    { value: "ICON", label: "Icono", ayuda: "Usa uno de la galería" },
  ];

  readonly loadingAnimaciones = LOADING_ANIMATIONS;

  /** Animaciones con icono y color para app-master-select. */
  readonly opcionesAnimacion: MasterOption[] = LOADING_ANIMATIONS.map((a) => opcionAnimacion(a.value, a.label));

  readonly loadingEfectosLogo = LOADING_LOGO_EFFECTS;

  readonly loadingTemas: { value: LoadingTheme; label: string }[] = [
    { value: "LIGHT", label: "Claro" },
    { value: "DARK", label: "Oscuro" },
  ];

  /** Paleta de arranque: el primero es el color primario vigente. */
  get loadingColores(): string[] {
    const base = this.config.primaryColor || "#062e86";
    return [
      base,
      "#ec9811",
      "#0ea5e9",
      "#059669",
      "#7c3aed",
      "#dc2626",
      "#0f172a",
      "#ffffff",
    ];
  }

  /** Blanco o negro: lo unico que garantiza contraste en cualquier fondo. */
  readonly loadingColoresTexto: string[] = ["#ffffff", "#000000"];

  /** Vista del splash tal y como se vera al arrancar la aplicacion. */
  get loadingPreview(): LoadingScreenView {
    return resolveLoadingScreen(this.config, "Mesa de Servicios COAC");
  }

  /** Nombre legible del icono elegido, para no mostrar solo la clase. */
  loadingIconoNombre(): string {
    const actual = this.config.loadingIcon;
    return (
      this.loadingIconos.find((i) => i.value === actual)?.label ??
      "Icono personalizado"
    );
  }

  /** La animación elegida no se pinta en la miniatura, solo su etiqueta. */
  loadingAnimacionNombre(): string {
    const actual = this.config.loadingAnimation || "SPINNER";
    return (
      this.loadingAnimaciones.find((a) => a.value === actual)?.label ??
      "Círculo"
    );
  }

  /** Nombre del efecto del logo elegido. */
  loadingEfectoNombre(): string {
    const actual = this.config.loadingLogoEffect || "NONE";
    return (
      this.loadingEfectosLogo.find((e) => e.value === actual)?.label ??
      "Sin efecto"
    );
  }

  /** Clase CSS del efecto, para animar cada miniatura del selector. */
  loadingEfectoClase(value: LoadingLogoEffect): string {
    return loadingLogoEffectClass(value);
  }

  onLoadingImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loadingImageFile = input.files?.[0] || null;
    if (this.loadingImageFile) {
      const reader = new FileReader();
      reader.onload = () =>
        (this.loadingImagePreview = reader.result as string);
      reader.readAsDataURL(this.loadingImageFile);
    }
  }

  /**
   * Al elegir una marca propia se activa el modo "solo el logo": quien sube
   * una imagen quiere verla limpia, no con un "Cargando..." encima. El
   * interruptor sigue siendo editable por si luego quiere lo contrario.
   */
  cambiarModoLoading(modo: LoadingMode): void {
    this.config.loadingMode = modo;
    if (modo === "IMAGE" || modo === "ICON") {
      this.config.loadingSoloMarca = true;
    }
  }

  /** Igual que {@link cambiarModoLoading}, al escoger un icono de la galeria. */
  elegirIconoLoading(icono: string): void {
    this.config.loadingIcon = icono;
    this.config.loadingMode = "ICON";
    this.config.loadingSoloMarca = true;
  }

  uploadLoadingImage(): void {
    if (!this.loadingImageFile) return;
    this.loading = true;
    this.adminService.uploadLoadingImage(this.loadingImageFile).subscribe({
      next: (res) => {
        this.config.loadingImageUrl = res.url;
        // El backend tambien lo fuerza a IMAGE; se replica aqui para que la
        // miniatura refleje el cambio sin volver a cargar la configuracion.
        this.config.loadingMode = "IMAGE";
        this.loadingImagePreview = res.url;
        this.loadingImageFile = null;
        this.loading = false;
        this.toastService.success("Imagen de la pantalla de carga subida");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message ||
            "No se pudo subir la imagen de la pantalla de carga",
        );
      },
    });
  }

  /** Vuelve al icono del sistema dejando el campo de imagen vacio. */
  clearLoadingImage(): void {
    this.config.loadingImageUrl = "";
    this.config.loadingMode = "AUTO";
    this.loadingImagePreview = "";
    this.loadingImageFile = null;
  }

  saveLoading(): void {
    this.loading = true;
    this.adminService.updateBranding(this.config).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.success("Pantalla de carga actualizada");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo guardar la pantalla de carga",
        );
      },
    });
  }

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.adminService.getBranding().subscribe({
      next: (c) => {
        this.config = c;
        this.logoPreview = c.logoUrl || "";
        this.backgroundPreview = c.backgroundUrl || "";
        this.logoLoginPreview = c.logoLoginUrl || "";
        this.systemIconPreview = c.systemIconUrl || "";
        this.reportLogoPreview = c.reportLogoUrl || c.logoUrl || "";
        this.profileCoverPreview = c.profileCoverUrl || "";
        this.chatBackgroundLightPreview =
          c.chatBackgroundLightUrl || c.chatBackgroundUrl || "";
        this.chatBackgroundDarkPreview = c.chatBackgroundDarkUrl || "";
        this.loadingImagePreview = c.loadingImageUrl || "";
      },
      error: () => {
        this.config = {
          logoUrl: "",
          backgroundUrl: "",
          logoLoginUrl: "",
          systemIconUrl: "",
          primaryColor: "#062e86",
          secondaryColor: "#ec9811",
        };
        this.logoPreview = "";
        this.backgroundPreview = "";
        this.logoLoginPreview = "";
        this.systemIconPreview = "";
        this.reportLogoPreview = "";
        this.profileCoverPreview = "";
        this.chatBackgroundLightPreview = "";
        this.chatBackgroundDarkPreview = "";
        this.loadingImagePreview = "";
      },
    });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile = input.files?.[0] || null;
    if (this.logoFile) {
      const reader = new FileReader();
      reader.onload = () => (this.logoPreview = reader.result as string);
      reader.readAsDataURL(this.logoFile);
    }
  }

  onBackgroundSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.backgroundFile = input.files?.[0] || null;
    if (this.backgroundFile) {
      const reader = new FileReader();
      reader.onload = () => (this.backgroundPreview = reader.result as string);
      reader.readAsDataURL(this.backgroundFile);
    }
  }

  onLogoLoginSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoLoginFile = input.files?.[0] || null;
    if (this.logoLoginFile) {
      const reader = new FileReader();
      reader.onload = () => (this.logoLoginPreview = reader.result as string);
      reader.readAsDataURL(this.logoLoginFile);
    }
  }

  onSystemIconSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.systemIconFile = input.files?.[0] || null;
    if (this.systemIconFile) {
      const reader = new FileReader();
      reader.onload = () => (this.systemIconPreview = reader.result as string);
      reader.readAsDataURL(this.systemIconFile);
    }
  }

  onReportLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reportLogoFile = input.files?.[0] || null;
    if (this.reportLogoFile) {
      const reader = new FileReader();
      reader.onload = () => (this.reportLogoPreview = reader.result as string);
      reader.readAsDataURL(this.reportLogoFile);
    }
  }

  onProfileCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.profileCoverFile = input.files?.[0] || null;
    if (this.profileCoverFile) {
      const reader = new FileReader();
      reader.onload = () =>
        (this.profileCoverPreview = reader.result as string);
      reader.readAsDataURL(this.profileCoverFile);
    }
  }

  onChatBackgroundLightSelected(event: Event): void {
    this.selectChatBackground(event, "light");
  }

  onChatBackgroundDarkSelected(event: Event): void {
    this.selectChatBackground(event, "dark");
  }

  private selectChatBackground(event: Event, mode: ChatBackgroundMode): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (mode === "light") {
      this.chatBackgroundLightFile = file;
    } else {
      this.chatBackgroundDarkFile = file;
    }
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        if (mode === "light") {
          this.chatBackgroundLightPreview = preview;
        } else {
          this.chatBackgroundDarkPreview = preview;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  uploadLogo(): void {
    if (!this.logoFile) return;
    this.loading = true;
    this.adminService.uploadLogo(this.logoFile).subscribe({
      next: (res) => {
        this.config.logoUrl = res.url;
        this.logoPreview = res.url;
        this.loading = false;
        this.toastService.success("Logo subido");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir el logo",
        );
      },
    });
  }

  uploadBackground(): void {
    if (!this.backgroundFile) return;
    this.loading = true;
    this.adminService.uploadBackground(this.backgroundFile).subscribe({
      next: (res) => {
        this.config.backgroundUrl = res.url;
        this.backgroundPreview = res.url;
        this.loading = false;
        this.toastService.success("Imagen de fondo subida");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir la imagen de fondo",
        );
      },
    });
  }

  uploadLogoLogin(): void {
    if (!this.logoLoginFile) return;
    this.loading = true;
    this.adminService.uploadLogoLogin(this.logoLoginFile).subscribe({
      next: (res) => {
        this.config.logoLoginUrl = res.url;
        this.logoLoginPreview = res.url;
        this.loading = false;
        this.toastService.success("Logo del login subido");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir el logo del login",
        );
      },
    });
  }

  uploadSystemIcon(): void {
    if (!this.systemIconFile) return;
    this.loading = true;
    this.adminService.uploadSystemIcon(this.systemIconFile).subscribe({
      next: (res) => {
        this.config.systemIconUrl = res.url;
        this.systemIconPreview = res.url;
        this.loading = false;
        this.toastService.success("Icono del sistema subido");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir el icono del sistema",
        );
      },
    });
  }

  uploadReportLogo(): void {
    if (!this.reportLogoFile) return;
    this.loading = true;
    this.adminService.uploadReportLogo(this.reportLogoFile).subscribe({
      next: (res) => {
        this.config.reportLogoUrl = res.url;
        this.reportLogoPreview = res.url;
        this.loading = false;
        this.toastService.success("Icono de reportes subido");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir el icono de reportes",
        );
      },
    });
  }

  uploadProfileCover(): void {
    if (!this.profileCoverFile) return;
    this.loading = true;
    this.adminService.uploadProfileCover(this.profileCoverFile).subscribe({
      next: (res) => {
        this.config.profileCoverUrl = res.url;
        this.profileCoverPreview = res.url;
        this.loading = false;
        this.toastService.success("Portada del perfil subida");
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir la portada del perfil",
        );
      },
    });
  }

  uploadChatBackground(mode: ChatBackgroundMode): void {
    const file =
      mode === "light"
        ? this.chatBackgroundLightFile
        : this.chatBackgroundDarkFile;
    if (!file) return;
    this.loading = true;
    this.adminService.uploadChatBackground(file, mode).subscribe({
      next: (res) => {
        if (mode === "light") {
          this.config.chatBackgroundLightUrl = res.url;
          this.chatBackgroundLightPreview = res.url;
        } else {
          this.config.chatBackgroundDarkUrl = res.url;
          this.chatBackgroundDarkPreview = res.url;
        }
        this.loading = false;
        this.toastService.success(
          `Fondo ${mode === "light" ? "claro" : "oscuro"} de los chats subido`,
        );
        this.applyChatBackgrounds();
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudo subir el fondo de los chats",
        );
      },
    });
  }

  private applyChatBackgrounds(): void {
    setChatBackground(
      this.config.chatBackgroundLightUrl || this.config.chatBackgroundUrl,
      this.config.chatBackgroundDarkUrl,
    );
  }

  saveColors(): void {
    this.loading = true;
    this.adminService.updateBranding(this.config).subscribe({
      next: () => {
        this.loading = false;
        this.toastService.success("Colores actualizados");
        this.applyColors();
        this.applyChatBackgrounds();
      },
      error: (e) => {
        this.loading = false;
        this.toastService.error(
          e?.error?.message || "No se pudieron guardar los colores",
        );
      },
    });
  }

  applyColors(): void {
    applyBrandingTheme({
      primaryColor: this.config.primaryColor,
      secondaryColor: this.config.secondaryColor,
    });
  }

  tab: "logos" | "imagenes" | "colores" | "carga" = "logos";

  readonly tabs = [
    {
      id: "logos" as const,
      label: "Logos e iconos",
      icon: "fa-solid fa-image",
    },
    {
      id: "imagenes" as const,
      label: "Imágenes",
      icon: "fa-solid fa-mountain-sun",
    },
    { id: "colores" as const, label: "Colores", icon: "fa-solid fa-palette" },
    {
      id: "carga" as const,
      label: "Pantalla de carga",
      icon: "fa-solid fa-spinner",
    },
  ];

  get loadingModoAyuda(): string {
    const actual = this.config.loadingMode;
    return (
      this.loadingModos.find((m) => m.value === actual)?.ayuda ??
      "Selecciona una opción"
    );
  }
}

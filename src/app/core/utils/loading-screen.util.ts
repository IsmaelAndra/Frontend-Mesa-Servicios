import { BrandingConfig } from '../services/admin.service';
import { contrastColor } from './branding-theme.util';

/** Modo de la pantalla de carga: AUTO usa el icono del sistema. */
export type LoadingMode = 'AUTO' | 'IMAGE' | 'ICON';
export type LoadingAnimation =
  | 'SPINNER'
  | 'RING'
  | 'DOTS'
  | 'BARS'
  | 'BALL'
  | 'INFINITY'
  | 'PULSE'
  | 'NONE';
export type LoadingLogoEffect =
  | 'NONE'
  | 'FADE'
  | 'FADE_IN'
  | 'SCALE_PULSE'
  | 'ZOOM'
  | 'FLOAT'
  | 'BOUNCE'
  | 'GLOW'
  | 'SHIMMER'
  | 'SWING'
  | 'SPIN';
export type LoadingTheme = 'LIGHT' | 'DARK';

/** Tamaño por defecto del logo del splash, en px. */
export const DEFAULT_LOADING_IMAGE_SIZE = 112;
/** Rango admisible del tamaño del logo, en px. */
export const MIN_LOADING_IMAGE_SIZE = 48;
export const MAX_LOADING_IMAGE_SIZE = 256;

/** Icono usado cuando la marca no define uno propio. */
export const DEFAULT_LOADING_ICON = 'fa-solid fa-coffee-bean';
/** Duración minima por defecto, en ms. */
export const DEFAULT_LOADING_MIN_DURATION_MS = 1200;
/** Tope del campo de duración mínima, para que el splash no se quede pegado. */
export const MAX_LOADING_MIN_DURATION_MS = 10000;

/** Forma final que consume la plantilla del splash: ya sin valores vacios. */
export interface LoadingScreenView {
  mode: LoadingMode;
  /** Ruta de la imagen a mostrar, resuelta (imagen propia, icono o marca). */
  imageUrl: string;
  /** Clase de Font Awesome cuando el modo es ICON. */
  icon: string;
  backgroundColor: string;
  textColor: string;
  title: string;
  message: string;
  animation: LoadingAnimation;
  /** Efecto aplicado al logo o al icono del splash. */
  logoEffect: LoadingLogoEffect;
  /** Clase CSS del efecto, lista para aplicar con ngClass. */
  logoEffectClass: string;
  progress: boolean;
  theme: LoadingTheme;
  minDurationMs: number;
  /**
   * Modo "solo el logo": no se pinta ni el titulo ni el mensaje, y el
   * indicador de carga se anula aunque se haya elegido uno.
   */
  soloMarca: boolean;
  /** Si se muestran los textos bajo la marca. */
  showTexts: boolean;
  /** Lado en px del logo o del icono del splash. */
  imageSize: number;
}

/**
 * Efectos del logo con su etiqueta. Se listan aqui y no en el componente
 * para que el selector del administrador y la pantalla real compartan
 * exactamente el mismo catalogo.
 */
export const LOADING_LOGO_EFFECTS: {
  value: LoadingLogoEffect;
  label: string;
  ayuda: string;
}[] = [
  { value: 'NONE', label: 'Sin efecto', ayuda: 'Estático' },
  { value: 'FADE', label: 'Desvanecido', ayuda: 'Aparece y desaparece' },
  { value: 'FADE_IN', label: 'Entrada', ayuda: 'Se muestra una vez' },
  { value: 'SCALE_PULSE', label: 'Latido', ayuda: 'Pulso suave' },
  { value: 'ZOOM', label: 'Zoom', ayuda: 'Acerca y aleja' },
  { value: 'FLOAT', label: 'Flotar', ayuda: 'Sube y baja' },
  { value: 'BOUNCE', label: 'Rebote', ayuda: 'Salta' },
  { value: 'GLOW', label: 'Resplandor', ayuda: 'Halo pulsante' },
  { value: 'SHIMMER', label: 'Brillo', ayuda: 'Barrido de luz' },
  { value: 'SWING', label: 'Balanceo', ayuda: 'Se inclina' },
  { value: 'SPIN', label: 'Giro', ayuda: 'Rueda despacio' },
];

/** Indicadores disponibles junto al logo. */
export const LOADING_ANIMATIONS: { value: LoadingAnimation; label: string }[] =
  [
    { value: 'SPINNER', label: 'Círculo' },
    { value: 'RING', label: 'Anillo' },
    { value: 'DOTS', label: 'Puntos' },
    { value: 'BARS', label: 'Barras' },
    { value: 'BALL', label: 'Pelota' },
    { value: 'INFINITY', label: 'Infinito' },
    { value: 'PULSE', label: 'Latido' },
    { value: 'NONE', label: 'Sin indicador' },
  ];

/**
 * Traduce el efecto a las clases de styles.css. Los efectos que necesitan una
 * posicion relativa (halo, barrido de luz) la incluyen aqui para que la
 * plantilla no tenga que acordarse.
 */
export function loadingLogoEffectClass(effect: LoadingLogoEffect): string {
  switch (effect) {
    case 'NONE':
      return '';
    case 'FADE':
      return 'loading-logo-fade';
    case 'FADE_IN':
      return 'loading-logo-fade-in';
    case 'SCALE_PULSE':
      return 'loading-logo-scale-pulse';
    case 'ZOOM':
      return 'loading-logo-zoom';
    case 'FLOAT':
      return 'loading-logo-float';
    case 'BOUNCE':
      return 'loading-logo-bounce';
    case 'GLOW':
      return 'loading-logo-glow';
    case 'SHIMMER':
      return 'loading-logo-shimmer';
    case 'SWING':
      return 'loading-logo-swing';
    case 'SPIN':
      return 'loading-logo-spin';
    default:
      return '';
  }
}

/** Marca de color usada cuando tampoco hay color primario informado. */
const FALLBACK_PRIMARY = '#062e86';

/**
 * Convierte la configuracion de marca en la vista del splash, rellenando
 * todos los valores por defecto. Vive aparte del componente para poder
 * probarla sin montar Angular, y porque la logica de "que se ve cuando no
 * hay nada configurado" es la parte que mas se rompe si cambia el backend.
 */
export function resolveLoadingScreen(
  config: Partial<BrandingConfig> | null | undefined,
  appTitle: string,
): LoadingScreenView {
  const primary = normalizeColor(config?.primaryColor) || FALLBACK_PRIMARY;
  const systemIcon =
    config?.systemIconUrl?.trim() || 'assets/icons/favicon-app.png';
  const customImage = config?.loadingImageUrl?.trim() || '';
  const customIcon = config?.loadingIcon?.trim() || '';

  // El modo se respeta, salvo que pida una imagen que no existe: en ese caso
  // se cae al icono del sistema para no dejar el splash vacio.
  const requested = toEnum<LoadingMode>(config?.loadingMode, [
    'AUTO',
    'IMAGE',
    'ICON',
  ]);
  let mode: LoadingMode = requested;
  if (mode === 'IMAGE' && !customImage) {
    mode = 'AUTO';
  }
  if (mode === 'ICON' && !customIcon) {
    mode = 'AUTO';
  }

  const backgroundColor =
    normalizeColor(config?.loadingBackgroundColor) || primary;
  const textColor =
    normalizeColor(config?.loadingTextColor) || contrastColor(backgroundColor);

  const logoEffect = toEnum<LoadingLogoEffect>(config?.loadingLogoEffect, [
    'NONE',
    'FADE',
    'FADE_IN',
    'SCALE_PULSE',
    'ZOOM',
    'FLOAT',
    'BOUNCE',
    'GLOW',
    'SHIMMER',
    'SWING',
    'SPIN',
  ]);

  // En modo "solo el logo" el indicador sobra: un "Cargando..." encima del
  // logo que el administrador eligio queda raro, y el propio logo ya deja
  // claro que la pantalla esta cargando. El valor elegido se guarda igual,
  // para que apagar el interruptor lo recupere.
  const soloMarca = config?.loadingSoloMarca === true;

  return {
    mode,
    imageUrl: mode === 'IMAGE' ? customImage : systemIcon,
    icon: customIcon || DEFAULT_LOADING_ICON,
    backgroundColor,
    textColor,
    title: config?.loadingTitle?.trim() || appTitle,
    message: config?.loadingMessage?.trim() || 'Cargando...',
    animation: soloMarca
      ? 'NONE'
      : toEnum<LoadingAnimation>(config?.loadingAnimation, [
          'SPINNER',
          'RING',
          'DOTS',
          'BARS',
          'BALL',
          'INFINITY',
          'PULSE',
          'NONE',
        ]),
    logoEffect,
    logoEffectClass: loadingLogoEffectClass(logoEffect),
    progress: config?.loadingProgress === true,
    theme: toEnum<LoadingTheme>(config?.loadingTheme, ['LIGHT', 'DARK']),
    minDurationMs: clampDuration(config?.loadingMinDurationMs),
    soloMarca,
    showTexts: !soloMarca,
    imageSize: clampSize(config?.loadingImageSize),
  };
}

/** Tamaño del logo acotado: por debajo se pierde y por encima no cabe en móvil. */
export function clampSize(value: number | undefined | null): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_LOADING_IMAGE_SIZE;
  }
  return Math.min(Math.max(Math.round(value), MIN_LOADING_IMAGE_SIZE), MAX_LOADING_IMAGE_SIZE);
}

/** Duración mínima acotada; un valor absurdo dejaria el splash congelado. */
export function clampDuration(value: number | undefined | null): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return DEFAULT_LOADING_MIN_DURATION_MS;
  }
  return Math.min(Math.max(Math.round(value), 0), MAX_LOADING_MIN_DURATION_MS);
}

function toEnum<T extends string>(value: unknown, permitidos: T[]): T {
  const limpio = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (permitidos as string[]).includes(limpio) ? (limpio as T) : permitidos[0];
}

/** Solo acepta #rgb o #rrggbb; cualquier otra cosa se descarta. */
function normalizeColor(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const hex = value.trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return '#' + hex.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#' + hex.toLowerCase();
  }
  return '';
}

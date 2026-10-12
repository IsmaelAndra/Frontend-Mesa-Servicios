import { ErrorPageTexts } from '../services/admin.service';

/**
 * Resolucion de los textos de una pantalla de error.
 *
 * Vive aparte del componente, y no dentro del servicio, por una razon concreta:
 * estas pantallas se muestran cuando algo va mal, asi que su codigo no puede
 * depender de que la peticion HTTP funcione. La funcion recibe lo que llego (que
 * puede ser null, un objeto a medias o un error de red) y devuelve siempre
 * algo pintable. Se prueba sin montar Angular.
 */

/** Codigos HTTP con pantalla propia. */
export type ErrorStatus = 404 | 403 | 500 | 503;

export const ERROR_STATUSES: ErrorStatus[] = [404, 403, 500, 503];

/** Texto de un estado ya resuelto y listo para pintar. */
export interface ResolvedErrorPage {
  status: number;
  title: string;
  message: string;
  icon: string;
  color: string;
}

/**
 * Respaldos por codigo. Son los mismos textos que siembra data.sql: si el
 * backend no responde, el usuario ve algo coherente en lugar de una pagina en
 * blanco. No es material duplicado a proposito, es la garantia de que la
 * pantalla de 500 funcione sin backend.
 */
const RESPALDO: Record<ErrorStatus, ResolvedErrorPage> = {
  404: {
    status: 404,
    title: 'Página no encontrada',
    message:
      'La dirección que buscas no existe o fue movida. Revisa el enlace o vuelve al inicio.',
    icon: 'fa-solid fa-compass',
    color: '#64748b',
  },
  403: {
    status: 403,
    title: 'Acceso no autorizado',
    message:
      'Tu perfil no tiene permiso para ver esta sección. Si crees que es un error, '
      + 'solicita el acceso al administrador.',
    icon: 'fa-solid fa-lock',
    color: '#d97706',
  },
  500: {
    status: 500,
    title: 'Error interno del servidor',
    message:
      'Ocurrió un problema inesperado en el servidor. El equipo técnico ya fue notificado.',
    icon: 'fa-solid fa-triangle-exclamation',
    color: '#dc2626',
  },
  503: {
    status: 503,
    title: 'Servicio no disponible',
    message:
      'El sistema está temporalmente fuera de servicio por mantenimiento. '
      + 'Vuelve a intentar en unos minutos.',
    icon: 'fa-solid fa-screwdriver-wrench',
    color: '#2563eb',
  },
};

/** Texto generico para un codigo que no tiene pantalla propia. */
export const ERROR_GENERICO: ResolvedErrorPage = {
  status: 0,
  title: 'No se pudo cargar la página',
  message: 'Ocurrió un problema inesperado. Intenta de nuevo en unos minutos.',
  icon: 'fa-solid fa-triangle-exclamation',
  color: '#94a3b8',
};

/**
 * Codigo de la situacion a la que se llega. No siempre viene de la URL: el
 * guard de mantenimiento salta antes de que exista ruta, y un 403 lo decide el
 * RoleGuard. Se normaliza a string para no depender de Number() con NaN.
 */
export function normalizarStatus(valor: number | string | null | undefined): ErrorStatus | null {
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return (ERROR_STATUSES as number[]).includes(n) ? (n as ErrorStatus) : null;
}

/** Cadenas sueltas: si el backend no devolvio el campo, el respaldo gana. */
function texto(valor: string | null | undefined, respaldo: string): string {
  return typeof valor === 'string' && valor.trim() ? valor : respaldo;
}

/** El color se acota a un hexadecimal; un valor raro no debe romper la pantalla. */
function color(valor: string | null | undefined, respaldo: string): string {
  const v = typeof valor === 'string' ? valor.trim() : '';
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : respaldo;
}

/**
 * Resuelve el texto de un estado a partir de lo que devolvio el backend.
 *
 * Ante un estado desconocido devuelve la pantalla generica en vez de fallar:
 * el wildcard de rutas lo usa para el 404, pero también para cualquier ruta
 * inexistente que llegue con otro codigo.
 */
export function resolveErrorPage(
  status: number | string | null | undefined,
  textos: Partial<ErrorPageTexts> | null | undefined,
): ResolvedErrorPage {
  const s = normalizarStatus(status);
  if (!s) return { ...ERROR_GENERICO };
  const base = RESPALDO[s];

  switch (s) {
    case 404:
      return {
        status: s,
        title: texto(textos?.error404Title, base.title),
        message: texto(textos?.error404Message, base.message),
        icon: texto(textos?.error404Icon, base.icon),
        color: color(textos?.error404Color, base.color),
      };
    case 403:
      return {
        status: s,
        title: texto(textos?.error403Title, base.title),
        message: texto(textos?.error403Message, base.message),
        icon: texto(textos?.error403Icon, base.icon),
        color: color(textos?.error403Color, base.color),
      };
    case 500:
      return {
        status: s,
        title: texto(textos?.error500Title, base.title),
        message: texto(textos?.error500Message, base.message),
        icon: texto(textos?.error500Icon, base.icon),
        color: color(textos?.error500Color, base.color),
      };
    case 503:
      return {
        status: s,
        title: texto(textos?.error503Title, base.title),
        message: texto(textos?.error503Message, base.message),
        icon: texto(textos?.error503Icon, base.icon),
        color: color(textos?.error503Color, base.color),
      };
  }
}

/**
 * Texto de mantenimiento, que convive con el 503 pero no es lo mismo: aqui el
 * sistema avisa de que esta fuera de servicio de forma prevista, con una fecha
 * estimada de vuelta. Se resuelve aparte para no mezclarla con el 503.
 */
export interface ResolvedMaintenance {
  titulo: string;
  mensaje: string;
  eta: string;
  activo: boolean;
}

export function resolveMaintenance(branding: {
  maintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  maintenanceEta?: string;
} | null | undefined): ResolvedMaintenance {
  const activo = branding?.maintenanceMode === true;
  return {
    titulo: texto(branding?.maintenanceTitle, 'Mesa de servicios en mantenimiento'),
    mensaje: texto(
      branding?.maintenanceMessage,
      'El sistema está temporalmente fuera de servicio por mantenimiento. '
      + 'Vuelve a intentar en unos minutos.',
    ),
    eta: texto(branding?.maintenanceEta, ''),
    activo,
  };
}
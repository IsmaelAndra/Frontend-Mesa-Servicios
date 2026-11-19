import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

/**
 * Pantallas que solo se usan desde un computador: editores grandes (HTML de
 * plantillas, constructor de automatizaciones) y configuración técnica. En el
 * teléfono y en la tableta se ve un aviso en su lugar y el menú no las ofrece. El resto de la
 * aplicación sí debe funcionar en el teléfono (Fase 5).
 */
export const RUTAS_SOLO_ESCRITORIO = [
  '/automatizaciones',
  '/administracion/plantillas',
  '/administracion/plantillas-area',
  '/administracion/paginas-sistema',
  '/administracion/marca',
  '/administracion/temas-temporada',
  '/administracion/correo-microsoft',
  '/administracion/telefonia',
  '/administracion/inteligencia-artificial',
  '/administracion/cola-correo',
  '/administracion/base-datos',
];

/**
 * Ancho por debajo del cual no se ofrecen (el "lg" de Tailwind): teléfonos y
 * tabletas. Con 768 una tableta abría el constructor de automatizaciones y los
 * editores de plantillas, que no se pueden usar bien en esa pantalla.
 */
export const ANCHO_ESCRITORIO = 1024;

export function esPantallaPequena(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < ANCHO_ESCRITORIO;
}

export function esSoloEscritorio(url: string): boolean {
  const ruta = url.split(/[?#]/)[0];
  return RUTAS_SOLO_ESCRITORIO.some((r) => ruta === r || ruta.startsWith(r + '/'));
}

/** En el teléfono o la tableta, una pantalla de solo computador lleva al aviso. */
export const soloEscritorioGuard: CanActivateChildFn = (_route, state) => {
  if (!esPantallaPequena() || !esSoloEscritorio(state.url)) return true;
  return inject(Router).createUrlTree(['/solo-computador'], { queryParams: { desde: state.url.split('?')[0] } });
};

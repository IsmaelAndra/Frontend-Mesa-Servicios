import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Angular reutiliza el componente cuando solo cambian los parámetros de la ruta
 * (de /tickets/A a /tickets/B). El detalle del ticket lee el id una sola vez al
 * arrancar, así que al saltar de un ticket a otro (búsqueda, notificación,
 * enlace en el chat) la URL cambiaba pero la pantalla seguía mostrando el
 * anterior.
 *
 * Las rutas con `data.recrearAlCambiarParametros` se crean de nuevo cuando
 * cambia algún parámetro: el componente arranca limpio (chat, SSE, SLA, ficha)
 * en lugar de tener que reiniciar a mano cada pieza de su estado.
 */
@Injectable()
export class ReutilizacionRutasStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(futura: ActivatedRouteSnapshot, actual: ActivatedRouteSnapshot): boolean {
    if (futura.routeConfig !== actual.routeConfig) {
      return false;
    }
    if (futura.data?.['recrearAlCambiarParametros']) {
      return mismosParametros(futura.params, actual.params);
    }
    return true;
  }
}

function mismosParametros(a: Record<string, string>, b: Record<string, string>): boolean {
  const claves = Object.keys(a);
  return claves.length === Object.keys(b).length && claves.every((k) => a[k] === b[k]);
}

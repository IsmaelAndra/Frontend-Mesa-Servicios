import { ActivatedRouteSnapshot, Route } from '@angular/router';
import { ReutilizacionRutasStrategy } from './reutilizacion-rutas.strategy';

describe('ReutilizacionRutasStrategy', () => {
  const estrategia = new ReutilizacionRutasStrategy();
  const detalle: Route = { path: ':id', data: { recrearAlCambiarParametros: true } };
  const lista: Route = { path: 'kanban' };

  function snap(routeConfig: Route, params: Record<string, string>): ActivatedRouteSnapshot {
    return { routeConfig, params, data: routeConfig.data ?? {} } as unknown as ActivatedRouteSnapshot;
  }

  it('de un ticket a otro NO reutiliza el componente (antes la pantalla no cambiaba)', () => {
    expect(estrategia.shouldReuseRoute(snap(detalle, { id: 'b' }), snap(detalle, { id: 'a' }))).toBeFalse();
  });

  it('el mismo ticket se reutiliza', () => {
    expect(estrategia.shouldReuseRoute(snap(detalle, { id: 'a' }), snap(detalle, { id: 'a' }))).toBeTrue();
  });

  it('las demás rutas se comportan como siempre', () => {
    expect(estrategia.shouldReuseRoute(snap(lista, {}), snap(lista, {}))).toBeTrue();
    expect(estrategia.shouldReuseRoute(snap(lista, {}), snap(detalle, { id: 'a' }))).toBeFalse();
  });
});

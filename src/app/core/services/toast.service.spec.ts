import { fakeAsync, tick } from '@angular/core/testing';
import { ToastItem, ToastService } from './toast.service';

/** Avisos: repetidos agrupados, máximo en pantalla y salida animada. */
describe('ToastService', () => {
  let servicio: ToastService;
  let actuales: ToastItem[];

  beforeEach(() => {
    servicio = new ToastService();
    servicio.toasts$.subscribe((t) => (actuales = t));
  });

  it('el mismo aviso repetido suma un contador en vez de apilar copias', () => {
    servicio.error('Sin conexión');
    servicio.error('Sin conexión');
    servicio.error('Sin conexión');
    expect(actuales.length).toBe(1);
    expect(actuales[0].count).toBe(3);
    // Cada repetición reinicia la cuenta atrás (cambia la versión).
    expect(actuales[0].version).toBe(2);
  });

  it('avisos distintos sí se apilan', () => {
    servicio.success('Guardado');
    servicio.error('Guardado');
    expect(actuales.length).toBe(2);
  });

  it('los errores duran más que los avisos informativos, y más aún con botón', () => {
    servicio.info('Hola');
    servicio.error('Fallo');
    servicio.info('Con botón', 'Info', { action: { label: 'Ver', route: '/x' } });
    const [info, error, conBoton] = actuales;
    expect(error.duration).toBeGreaterThan(info.duration);
    expect(conBoton.duration).toBeGreaterThan(info.duration);
  });

  it('por encima del máximo, el más antiguo sale', fakeAsync(() => {
    for (let i = 0; i < 6; i++) servicio.info(`Aviso ${i}`);
    expect(actuales.find((t) => t.message === 'Aviso 0')?.leaving).toBeTrue();
    tick(ToastService.SALIDA_MS);
    expect(actuales.some((t) => t.message === 'Aviso 0')).toBeFalse();
    expect(actuales.length).toBe(5);
  }));

  it('dismiss marca la salida y lo quita al terminar la animación', fakeAsync(() => {
    servicio.success('Listo');
    const id = actuales[0].id;
    servicio.dismiss(id);
    expect(actuales[0].leaving).toBeTrue();
    tick(ToastService.SALIDA_MS);
    expect(actuales.length).toBe(0);
  }));

  it('un aviso que está saliendo no absorbe una repetición nueva', fakeAsync(() => {
    servicio.warn('Atento');
    servicio.dismiss(actuales[0].id);
    servicio.warn('Atento');
    expect(actuales.length).toBe(2);
    tick(ToastService.SALIDA_MS);
    expect(actuales.length).toBe(1);
    expect(actuales[0].count).toBe(1);
  }));
});

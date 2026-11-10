import { agruparPorFecha } from './agrupar-por-fecha.util';

describe('agruparPorFecha', () => {
  const ahora = new Date(2026, 10, 9, 10, 0, 0);
  const dias = (d: number, h = 9) => new Date(2026, 10, 9 - d, h, 0, 0).toISOString();

  it('reparte en Hoy, Ayer, Últimos 7 días y Anteriores', () => {
    const lista = [{ f: dias(0) }, { f: dias(1, 23) }, { f: dias(3) }, { f: dias(7, 1) }, { f: dias(30) }];
    const g = agruparPorFecha(lista, (x) => x.f, ahora);
    expect(g.map((x) => x.label)).toEqual(['Hoy', 'Ayer', 'Últimos 7 días', 'Anteriores']);
    expect(g.map((x) => x.items.length)).toEqual([1, 1, 2, 1]);
  });

  it('omite los grupos vacíos y soporta lista nula', () => {
    expect(agruparPorFecha([{ f: dias(0) }], (x) => x.f, ahora).map((x) => x.label)).toEqual(['Hoy']);
    expect(agruparPorFecha(null, (x: { f: string }) => x.f, ahora)).toEqual([]);
  });
});

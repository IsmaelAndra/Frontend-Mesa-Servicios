import { duracionLegible } from './duracion.util';

describe('duracionLegible', () => {
  it('por debajo de una hora deja los minutos', () => {
    expect(duracionLegible(30)).toBe('30 min');
  });

  it('horas exactas y horas con minutos', () => {
    expect(duracionLegible(240)).toBe('4 h');
    expect(duracionLegible(90)).toBe('1 h 30 min');
  });

  it('a partir de un día habla en días, con las horas si las hay', () => {
    expect(duracionLegible(2880)).toBe('2 d');
    expect(duracionLegible(1500)).toBe('1 d 1 h');
  });

  it('sin dato, cero o negativo muestra un guion', () => {
    expect(duracionLegible(null)).toBe('—');
    expect(duracionLegible(undefined)).toBe('—');
    expect(duracionLegible(0)).toBe('—');
    expect(duracionLegible(-5)).toBe('—');
  });
});

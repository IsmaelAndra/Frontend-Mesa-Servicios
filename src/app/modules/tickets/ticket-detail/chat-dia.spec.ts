import { etiquetaDia } from './ticket-detail.component';

describe('etiquetaDia (separador de día del chat)', () => {
  const hoy = new Date(2026, 9, 8, 15, 0); // jueves 8 de octubre de 2026

  it('el mismo día es "Hoy" y el anterior "Ayer"', () => {
    expect(etiquetaDia(new Date(2026, 9, 8, 0, 5), hoy)).toBe('Hoy');
    expect(etiquetaDia(new Date(2026, 9, 7, 23, 59), hoy)).toBe('Ayer');
  });

  it('otro día del año: día de la semana, número y mes, solo la primera en mayúscula', () => {
    expect(etiquetaDia(new Date(2026, 9, 1, 10, 0), hoy)).toBe('Jueves 1 de oct.');
    expect(etiquetaDia(new Date(2026, 8, 30, 10, 0), hoy)).toBe('Miércoles 30 de sep.');
  });

  it('de otro año, añade el año', () => {
    expect(etiquetaDia(new Date(2025, 11, 31, 10, 0), hoy)).toBe('Miércoles 31 de dic. 2025');
  });
});

import { EventObject } from '@toast-ui/calendar';
import { CalendarEvent } from '../../../models/task.model';
import { escaparHtml, plantillaEvento, urgenciaDe } from './calendar.component';

/**
 * Urgencia de los eventos y plantilla de la rejilla.
 *
 * La plantilla se inserta como HTML dentro de ToastUI y el título lo escribe
 * quien abre el ticket: si no se escapara, un título con etiquetas se
 * ejecutaría en el calendario de todo el personal.
 */
describe('Calendario: urgencia y plantilla', () => {
  const ahora = new Date('2026-10-07T12:00:00Z').getTime();

  function evento(parcial: Partial<CalendarEvent>): CalendarEvent {
    return {
      id: '1', type: 'TICKET', title: 'Impresora', start: '2026-10-07T08:00:00Z',
      end: '2026-10-07T18:00:00Z', status: 'EN_PROCESO', color: '#2563eb', refId: '7', allDay: false,
      ...parcial,
    };
  }

  it('un evento abierto cuyo fin ya pasó está vencido', () => {
    expect(urgenciaDe(evento({ end: '2026-10-07T10:00:00Z' }), ahora)).toBe('VENCIDO');
  });

  it('si vence en menos de 24 horas está por vencer', () => {
    expect(urgenciaDe(evento({ end: '2026-10-08T06:00:00Z' }), ahora)).toBe('PROXIMO');
  });

  it('con más de 24 horas de margen no tiene urgencia', () => {
    expect(urgenciaDe(evento({ end: '2026-10-10T06:00:00Z' }), ahora)).toBeNull();
  });

  it('lo cerrado o resuelto nunca está vencido', () => {
    for (const status of ['CERRADO', 'RESUELTO', 'COMPLETADA', 'cancelado']) {
      expect(urgenciaDe(evento({ status, end: '2026-10-01T00:00:00Z' }), ahora))
        .withContext(status)
        .toBeNull();
    }
  });

  it('una fecha ilegible no se marca como vencida', () => {
    expect(urgenciaDe(evento({ end: 'no-es-fecha' }), ahora)).toBeNull();
  });

  it('escapa los cinco caracteres con significado en HTML', () => {
    expect(escaparHtml(`<a href="x">'&'</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('la plantilla escapa el título del evento', () => {
    const ev = { title: '<img src=x onerror=alert(1)>', raw: {} } as unknown as EventObject;
    const html = plantillaEvento(ev, false);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('la plantilla añade el punto de urgencia cuando corresponde', () => {
    const vencido = { title: 'X', raw: { urgencia: 'VENCIDO' } } as unknown as EventObject;
    const proximo = { title: 'X', raw: { urgencia: 'PROXIMO' } } as unknown as EventObject;
    const normal = { title: 'X', raw: { urgencia: null } } as unknown as EventObject;
    expect(plantillaEvento(vencido, false)).toContain('cal-punto--vencido');
    expect(plantillaEvento(proximo, false)).toContain('cal-punto--proximo');
    expect(plantillaEvento(normal, false)).not.toContain('cal-punto');
  });
});

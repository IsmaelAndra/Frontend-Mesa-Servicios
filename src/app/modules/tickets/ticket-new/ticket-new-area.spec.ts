import { FormBuilder } from '@angular/forms';
import { convertToParamMap } from '@angular/router';
import { TicketNewComponent } from './ticket-new.component';

/** Área que atiende y categorías del área (mesa multi-área). */
describe('TicketNewComponent: área que atiende', () => {
  function crear(rol = 'USER'): TicketNewComponent {
    const auth = { getRole: () => rol } as never;
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as never;
    const c = new TicketNewComponent(new FormBuilder(), {} as never, {} as never, auth, {} as never, {} as never, route);
    c.categories = [
      { id: 'c1', name: 'Soporte', teamId: 't1', areaId: 'tec' },
      { id: 'c2', name: 'Redes', teamId: 't1', areaId: 'tec' },
      { id: 'c3', name: 'Sistemas internos', teamId: 't2', areaId: 'dev' },
    ];
    return c;
  }

  it('muestra solo las categorías del área elegida', () => {
    const c = crear();
    c.form.patchValue({ areaDestinoId: 'dev' });
    c.alCambiarArea();
    expect(c.categoriasDelArea.map((x) => x.id)).toEqual(['c3']);
  });

  it('al cambiar de área suelta una categoría que era de la otra', () => {
    const c = crear('AGENT');
    c.form.patchValue({ areaDestinoId: 'tec', categoryId: 'c1' });
    c.form.patchValue({ areaDestinoId: 'dev' });
    c.alCambiarArea();
    expect(c.form.value.categoryId).toBeNull();
  });

  it('el área es obligatoria', () => {
    const c = crear();
    expect(c.form.get('areaDestinoId')?.hasError('required')).toBeTrue();
  });
});

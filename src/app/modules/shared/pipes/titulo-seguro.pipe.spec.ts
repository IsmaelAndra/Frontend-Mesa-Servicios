import { tituloConEnfasis, tituloSinEtiquetas } from './titulo-seguro.pipe';

describe('título de ticket con énfasis', () => {
  it('deja la negrita como etiqueta real', () => {
    expect(tituloConEnfasis('Falla <b>urgente</b>')).toBe('Falla <b>urgente</b>');
  });

  it('no deja pasar nada más: el resto queda escapado como texto', () => {
    const r = tituloConEnfasis('<b>x</b> <img src=x onerror=alert(1)><script>y</script>');
    expect(r).toContain('<b>x</b>');
    expect(r).not.toContain('<img');
    expect(r).not.toContain('<script');
    expect(r).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('una etiqueta de énfasis con atributos no se activa', () => {
    expect(tituloConEnfasis('<b onclick="a()">x</b>')).not.toContain('<b onclick');
  });

  it('el tooltip sale sin etiquetas de énfasis', () => {
    expect(tituloSinEtiquetas('Falla <b>urgente</b>')).toBe('Falla urgente');
  });

  it('soporta vacío', () => {
    expect(tituloConEnfasis(null)).toBe('');
    expect(tituloSinEtiquetas(undefined)).toBe('');
  });
});

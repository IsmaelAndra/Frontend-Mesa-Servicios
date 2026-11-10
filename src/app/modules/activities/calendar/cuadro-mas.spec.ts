import { recolocarCuadroMas } from './calendar.component';

describe('cuadro "+N más" del calendario', () => {
  it('pasa las coordenadas de página a coordenadas de su contenedor posicionado', () => {
    const padre = document.createElement('div');
    padre.style.cssText = 'position:absolute; top:300px; left:200px; width:600px; height:400px;';
    const cuadro = document.createElement('div');
    cuadro.style.cssText = 'position:absolute;';
    padre.appendChild(cuadro);
    document.body.appendChild(padre);
    // Toast UI deja la posición de la celda en la página: 350 / 260.
    cuadro.style.top = `${350 + window.scrollY}px`;
    cuadro.style.left = `${260 + window.scrollX}px`;
    const r = padre.getBoundingClientRect();

    recolocarCuadroMas(cuadro);

    expect(parseFloat(cuadro.style.top)).toBeCloseTo(350 - r.top, 0);
    expect(parseFloat(cuadro.style.left)).toBeCloseTo(260 - r.left, 0);
    padre.remove();
  });

  it('no falla sin elemento', () => {
    expect(() => recolocarCuadroMas(null)).not.toThrow();
  });
});

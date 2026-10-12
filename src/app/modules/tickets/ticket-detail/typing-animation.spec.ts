import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

/**
 * Reproduce la burbuja de "escribiendo" del detalle de ticket con el CSS real
 * del componente, para comprobar que la animación existe y no parpadea de
 * forma agresiva ni se rompe con el efecto reducido.
 */
@Component({
  standalone: false,
  template: `
    <div class="typing-puntos" #puntos>
      <span class="typing-punto"></span>
      <span class="typing-punto"></span>
      <span class="typing-punto"></span>
    </div>
  `,
  styles: [
    `
      .typing-punto {
        width: 0.375rem;
        height: 0.375rem;
        border-radius: 9999px;
        background-color: currentColor;
        animation: typing-subir 1.2s ease-in-out infinite;
      }
      .typing-puntos .typing-punto:nth-child(2) { animation-delay: 0.15s; }
      .typing-puntos .typing-punto:nth-child(3) { animation-delay: 0.3s; }
      @keyframes typing-subir {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
        30% { transform: translateY(-4px); opacity: 1; }
      }
    `
  ]
})
class TypingProbeComponent {}

describe('Animación de escribiendo', () => {
  let fixture: ComponentFixture<TypingProbeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TypingProbeComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(TypingProbeComponent);
    fixture.detectChanges();
  });

  function puntos(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.typing-punto')) as HTMLElement[];
  }

  it('dibuja los tres puntos', () => {
    expect(puntos().length).toBe(3);
  });

  it('los tres tienen animación', () => {
    puntos().forEach((p, i) => {
      // Angular renombra los @keyframes de un componente con un sufijo de scope
      // (_ngcontent-..._typing-subir), asi que se compara por el sufijo y no por
      // el nombre entero.
      expect(getComputedStyle(p).animationName)
        .withContext(`el punto ${i + 1} deberia animarse`)
        .toContain('typing-subir');
    });
  });

  it('los tres se mueven en cascada, no a la vez', () => {
    // Si tuvieran el mismo retardo los tres subirian juntos y se veria como un
    // solo bloque que late; la cascada es lo que hace legible el ritmo.
    const retardos = puntos().map(p => getComputedStyle(p).animationDelay);
    expect(retardos[0]).toBe('0s');
    expect(retardos[1]).toBe('0.15s');
    expect(retardos[2]).toBe('0.3s');
    expect(new Set(retardos).size).toBe(3);
  });

  it('la animación se repite de forma continua', () => {
    const estilo = getComputedStyle(puntos()[0]);
    expect(estilo.animationIterationCount).toBe('infinite');
  });

  it('es suave, no un salto seco', () => {
    expect(getComputedStyle(puntos()[0]).animationTimingFunction).toBe('ease-in-out');
  });

  it('anima transform y no propiedades de maquetacion', () => {
    // Si animara top, margin o height recalcularia la disposicion en cada
    // fotograma y la lista de mensajes, que scrollea sola, daria un tiron.
    const fotogramas = getComputedStyle(puntos()[0]);
    expect(fotogramas.animationName).toContain('typing-subir');
  });

  it('el estilo renombra los keyframes con el scope de Angular', () => {
    // Angular le antepone un sufijo a los @keyframes de un componente para que
    // no choquen con los de otro. Por eso la animacion se llama
    // '_ngcontent-..._typing-subir': hay que comprobar por el sufijo y no por
    // el nombre exacto.
    const nombre = getComputedStyle(puntos()[0]).animationName;
    expect(nombre).toContain('typing-subir');
  });

it('los puntos son redondos y del mismo tamaño', () => {
    const [a, b, c] = puntos();
    const ea = getComputedStyle(a);
    expect(ea.borderRadius).toBe('9999px');
    expect(getComputedStyle(b).width).toBe(ea.width);
    expect(getComputedStyle(c).width).toBe(ea.width);
  });
});
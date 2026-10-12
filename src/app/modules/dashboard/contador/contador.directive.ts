import { Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

/**
 * Cuenta hasta la cifra al cargarla: `<span [appContador]="stats.totalTickets"></span>`.
 *
 * <p>Solo en la primera carga y en los cambios de periodo; al actualizar con la
 * misma cifra no se mueve. Corto (700 ms, frena al final) para que no retrase la
 * lectura, y con "reducir movimiento" pone la cifra sin animar.
 */
@Directive({
  selector: '[appContador]',
  standalone: true,
})
export class ContadorDirective implements OnChanges, OnDestroy {
  @Input('appContador') valor: number | null | undefined = 0;
  /** Decimales que se muestran. */
  @Input() decimales = 0;
  /** Texto tras la cifra ("%", " h"). */
  @Input() sufijo = '';

  private marco?: number;
  private mostrado = 0;
  private readonly reducido =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    const destino = Number(this.valor ?? 0);
    if (!Number.isFinite(destino)) {
      this.pintar(null);
      return;
    }
    if (this.reducido || destino === this.mostrado) {
      this.mostrado = destino;
      this.pintar(destino);
      return;
    }
    const desde = this.mostrado;
    const inicio = performance.now();
    const dur = 700;
    if (this.marco) cancelAnimationFrame(this.marco);
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / dur);
      const suave = 1 - Math.pow(1 - t, 3);
      this.pintar(desde + (destino - desde) * suave);
      if (t < 1) {
        this.marco = requestAnimationFrame(paso);
      } else {
        this.mostrado = destino;
        this.pintar(destino);
      }
    };
    this.marco = requestAnimationFrame(paso);
  }

  ngOnDestroy(): void {
    if (this.marco) cancelAnimationFrame(this.marco);
  }

  private pintar(v: number | null): void {
    this.el.nativeElement.textContent = v === null
      ? '—'
      : v.toLocaleString('es-EC', { minimumFractionDigits: this.decimales, maximumFractionDigits: this.decimales }) + this.sufijo;
  }
}

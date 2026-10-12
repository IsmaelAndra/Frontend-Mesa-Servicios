import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastAction, ToastItem, ToastService, ToastType } from '../../../../core/services/toast.service';

/**
 * Contenedor de los avisos emergentes.
 *
 * <p>Varios avisos se apilan en una pila compacta (el más nuevo delante y los
 * anteriores asomando detrás) y se despliegan al pasar el ratón. Mientras el
 * ratón está encima, o la pestaña no está visible, la cuenta atrás se pausa:
 * un aviso no debe desaparecer mientras alguien lo lee.
 *
 * <p>Se pueden cerrar deslizándolos hacia la derecha. Un arrastre corto vuelve a
 * su sitio; uno largo o rápido lo descarta. Hacia la izquierda ofrece
 * resistencia, para que se note que por ahí no se va.
 */
@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.css'],
})
export class ToastContainerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('toastEl') elementos?: QueryList<ElementRef<HTMLElement>>;

  /** Más nuevo primero: el índice 0 es el que va delante. */
  toasts: ToastItem[] = [];
  expandido = false;
  pestanaOculta = false;
  arrastre: { id: number; x: number; t: number; dx: number } | null = null;
  /** Avisos sacados con un deslizamiento: salen por la derecha, no con el fundido normal. */
  deslizados = new Set<number>();

  readonly HUECO = 10;
  /** Cuánto asoma cada aviso de detrás en la pila compacta. */
  readonly ASOMA = 10;
  /** A partir de cuántos de detrás ya no se ven. */
  readonly VISIBLES_PLEGADO = 3;

  private alturas = new Map<number, number>();
  private observador?: ResizeObserver;
  private sub?: Subscription;
  private subCambios?: Subscription;

  constructor(
    private toastService: ToastService,
    private router: Router,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe((t) => {
      this.toasts = [...t].reverse();
      if (this.toasts.length === 0) this.expandido = false;
    });
  }

  ngAfterViewInit(): void {
    // Las alturas reales hacen falta para desplegar la pila sin solapes: un
    // aviso con mensaje largo ocupa más que uno corto.
    this.observador = new ResizeObserver((entradas) => {
      let cambio = false;
      for (const e of entradas) {
        const id = Number((e.target as HTMLElement).dataset['id']);
        const h = Math.round((e.target as HTMLElement).offsetHeight);
        if (this.alturas.get(id) !== h) {
          this.alturas.set(id, h);
          cambio = true;
        }
      }
      if (cambio) this.zone.run(() => undefined);
    });
    const observar = () => this.elementos?.forEach((el) => this.observador?.observe(el.nativeElement));
    observar();
    this.subCambios = this.elementos?.changes.subscribe(() => observar());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCambios?.unsubscribe();
    this.observador?.disconnect();
  }

  @HostListener('document:visibilitychange')
  alCambiarVisibilidad(): void {
    this.pestanaOculta = document.visibilityState === 'hidden';
  }

  trackById(_: number, t: ToastItem): number {
    return t.id;
  }

  get pausado(): boolean {
    return this.expandido || this.pestanaOculta || this.arrastre !== null;
  }

  // ============================ Pila ============================

  private altura(t: ToastItem | undefined): number {
    return t ? this.alturas.get(t.id) ?? 72 : 0;
  }

  /** Posición de cada aviso: plegado en pila o desplegado en columna. */
  transformDe(i: number): string {
    if (this.expandido) {
      let y = 0;
      for (let k = 0; k < i; k++) y += this.altura(this.toasts[k]) + this.HUECO;
      return `translateY(-${y}px)`;
    }
    const escala = 1 - Math.min(i, this.VISIBLES_PLEGADO) * 0.05;
    return `translateY(-${Math.min(i, this.VISIBLES_PLEGADO) * this.ASOMA}px) scale(${escala})`;
  }

  /**
   * Plegados, los de detrás toman el alto del de delante: así asoman todos lo
   * mismo aunque uno tenga un mensaje más largo o un botón.
   */
  alturaPlegada(i: number): number | null {
    return !this.expandido && i > 0 ? this.altura(this.toasts[0]) : null;
  }

  opacidadDe(i: number): number {
    if (this.expandido) return 1;
    return i >= this.VISIBLES_PLEGADO ? 0 : 1;
  }

  /** Alto de la zona sensible al ratón: lo que ocupa la pila en cada estado. */
  get alturaContenedor(): number {
    if (this.toasts.length === 0) return 0;
    if (this.expandido) {
      return this.toasts.reduce((s, t) => s + this.altura(t), 0) + this.HUECO * (this.toasts.length - 1);
    }
    return this.altura(this.toasts[0]) + Math.min(this.toasts.length - 1, this.VISIBLES_PLEGADO - 1) * this.ASOMA;
  }

  // ============================ Cerrar y acciones ============================

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  ejecutar(t: ToastItem, accion: ToastAction): void {
    if (accion.handler) {
      accion.handler();
    } else if (accion.route) {
      const ruta = typeof accion.route === 'string' ? [accion.route] : accion.route;
      this.router.navigate(ruta as unknown[], { queryParams: accion.queryParams as Record<string, unknown> });
    }
    this.dismiss(t.id);
  }

  // ============================ Deslizar para cerrar ============================

  iniciarArrastre(ev: PointerEvent, t: ToastItem): void {
    if (ev.button !== 0 || (ev.target as HTMLElement).closest('button, a')) return;
    this.arrastre = { id: t.id, x: ev.clientX, t: performance.now(), dx: 0 };
  }

  @HostListener('window:pointermove', ['$event'])
  alMover(ev: PointerEvent): void {
    if (!this.arrastre) return;
    const dx = ev.clientX - this.arrastre.x;
    // Hacia la izquierda, resistencia: el aviso no se va por ahí.
    this.arrastre = { ...this.arrastre, dx: dx < 0 ? dx / 4 : dx };
  }

  @HostListener('window:pointerup')
  alSoltar(): void {
    const a = this.arrastre;
    if (!a) return;
    this.arrastre = null;
    const velocidad = a.dx / Math.max(1, performance.now() - a.t);
    if (a.dx > 80 || velocidad > 0.11) {
      this.deslizados.add(a.id);
      setTimeout(() => {
        this.toastService.remove(a.id);
        this.deslizados.delete(a.id);
      }, ToastService.SALIDA_MS);
    }
  }

  desplazamientoArrastre(t: ToastItem): string | null {
    return this.arrastre?.id === t.id ? `${this.arrastre.dx}px 0` : null;
  }

  // ============================ Apariencia por tipo ============================

  acento(type: ToastType): string {
    switch (type) {
      case 'success': return 'bg-success';
      case 'error': return 'bg-error';
      case 'warn': return 'bg-warning';
      default: return 'bg-info';
    }
  }

  iconBg(type: ToastType): string {
    switch (type) {
      case 'success': return 'bg-gradient-to-br from-success/25 to-success/5 text-success ring-success/25';
      case 'error': return 'bg-gradient-to-br from-error/25 to-error/5 text-error ring-error/25';
      case 'warn': return 'bg-gradient-to-br from-warning/30 to-warning/5 text-warning ring-warning/30';
      default: return 'bg-gradient-to-br from-info/25 to-info/5 text-info ring-info/25';
    }
  }

  /** Animación del icono al entrar: el éxito "salta", el error se sacude una vez. */
  iconAnim(type: ToastType): string {
    return type === 'success' ? 'animate-check-pop' : type === 'error' ? 'animate-shake' : 'animate-pop-in';
  }

  icon(type: ToastType): string {
    switch (type) {
      case 'success': return 'fa-solid fa-check';
      case 'error': return 'fa-solid fa-exclamation';
      case 'warn': return 'fa-solid fa-triangle-exclamation';
      default: return 'fa-solid fa-info';
    }
  }

  rol(type: ToastType): string {
    return type === 'error' ? 'alert' : 'status';
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/**
 * Esqueleto de carga: la forma de lo que va a aparecer, en gris y con un brillo
 * que la recorre.
 *
 * <p>Sustituye al spinner en listas, tablas y paneles. Con un spinner la página
 * está vacía y, al llegar los datos, todo salta de golpe; con el esqueleto el
 * espacio ya está reservado y la carga se percibe más corta.
 *
 * <ul>
 *   <li>{@code filas}: líneas de tabla (dentro de un {@code <td colspan>}).</li>
 *   <li>{@code tarjetas}: rejilla de tarjetas (KPI del dashboard).</li>
 *   <li>{@code panel}: bloque de texto (detalle, formulario).</li>
 * </ul>
 *
 * <p>Es standalone para poder usarlo también en los componentes standalone de
 * workflows; SharedModule lo reexporta para el resto.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full" role="status" aria-live="polite" [attr.aria-label]="etiqueta">
      <span class="sr-only">{{ etiqueta }}</span>

      <!-- Filas de tabla -->
      <div *ngIf="tipo === 'filas'" class="divide-y divide-base-200" aria-hidden="true">
        <div *ngFor="let f of lista; let i = index" class="flex items-center gap-4 py-3 px-2">
          <span class="esq w-8 h-8 rounded-full shrink-0"></span>
          <div class="flex-1 min-w-0 space-y-2">
            <span class="esq block h-3 rounded" [style.width.%]="ancho(i, 45, 30)"></span>
            <span class="esq block h-2.5 rounded" [style.width.%]="ancho(i + 3, 25, 20)"></span>
          </div>
          <span *ngFor="let c of columnasExtra" class="esq hidden md:block h-5 w-20 rounded-full"></span>
        </div>
      </div>

      <!-- Tarjetas -->
      <div
        *ngIf="tipo === 'tarjetas'"
        class="grid gap-4 grid-cols-1 sm:grid-cols-2"
        [ngClass]="{ 'lg:grid-cols-4': cantidad >= 4, 'lg:grid-cols-3': cantidad === 3 }"
        aria-hidden="true"
      >
        <div *ngFor="let f of lista" class="rounded-2xl border border-base-200 bg-base-100 p-5 space-y-3">
          <div class="flex items-center gap-3">
            <span class="esq w-10 h-10 rounded-xl"></span>
            <span class="esq h-3 w-24 rounded"></span>
          </div>
          <span class="esq block h-7 w-20 rounded"></span>
          <span class="esq block h-2.5 w-3/4 rounded"></span>
        </div>
      </div>

      <!-- Panel de texto -->
      <div *ngIf="tipo === 'panel'" class="space-y-3" aria-hidden="true">
        <span class="esq block h-5 w-1/3 rounded"></span>
        <span *ngFor="let f of lista; let i = index" class="esq block h-3 rounded" [style.width.%]="ancho(i, 90, 25)"></span>
      </div>
    </div>
  `,
  styles: [`
    .esq {
      position: relative;
      overflow: hidden;
      background: oklch(var(--bc) / 0.08);
    }
    /* El brillo recorre el bloque: indica que algo está llegando. */
    .esq::after {
      content: '';
      position: absolute;
      inset: 0;
      translate: -100% 0;
      background: linear-gradient(90deg, transparent, oklch(var(--bc) / 0.07), transparent);
      animation: esq-brillo 1.4s var(--ease-in-out) infinite;
    }
    @keyframes esq-brillo {
      to { translate: 100% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .esq::after { animation: none; }
    }
  `],
})
export class SkeletonComponent {
  @Input() tipo: 'filas' | 'tarjetas' | 'panel' = 'filas';
  @Input() cantidad = 5;
  /** Píldoras a la derecha de cada fila (estado, prioridad…), solo en pantallas anchas. */
  @Input() columnas = 2;
  /** Texto para lectores de pantalla. */
  @Input() etiqueta = 'Cargando…';

  get lista(): number[] {
    return Array.from({ length: Math.max(1, this.cantidad) }, (_, i) => i);
  }

  get columnasExtra(): number[] {
    return Array.from({ length: Math.max(0, this.columnas) }, (_, i) => i);
  }

  /** Anchos variados pero estables: filas idénticas delatan que es de mentira. */
  ancho(i: number, base: number, rango: number): number {
    return base + ((i * 37) % rango);
  }
}

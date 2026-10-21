import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

/**
 * Paginador reutilizable.
 * Es presentacional: el padre hace el slice de la lista y le pasa el total.
 * Sin resultados no pinta nada: el vacío lo explica cada tabla (antes salían
 * dos mensajes, el de la tabla y "Sin resultados para mostrar").
 */
@Component({
  selector: 'app-paginator',
  standalone: false,
  template: `
    <!-- ============================ CON CONTENIDO ============================ -->
    <div
      *ngIf="total > 0"
      class="mt-3 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-base-100 rounded-2xl border border-base-200 shadow-sm"
    >
      <!-- ============ Izquierda: resumen + selector ============ -->
      <div
        class="flex items-center gap-3 flex-wrap justify-center sm:justify-start w-full sm:w-auto"
      >
        <span class="inline-flex items-center gap-1.5 text-xs">
          <i
            class="fa-solid fa-list text-primary text-[10px]"
            aria-hidden="true"
          ></i>
          <span class="opacity-70">Mostrando</span>
          <strong class="text-base-content font-semibold">
            {{ rangoInicio }}–{{ rangoFin }}
          </strong>
          <span class="opacity-70">de</span>
          <strong class="text-primary font-semibold">{{ total }}</strong>
        </span>

        <div class="flex items-center gap-2">
          <select
            class="select select-bordered select-xs w-14 h-8 bg-primary text-white hover:brightness-110 hover:bg-primary/80 focus:ring-2 focus:ring-primary/25"
            [value]="pageSize"
            (change)="onPageSizeChange($any($event.target).value)"
            aria-label="Filas por página"
          >
            <option *ngFor="let s of opciones" [value]="s" [selected]="s === pageSize">
              {{ s }}
            </option>
          </select>
        </div>
      </div>

      <!-- ============ Derecha: navegación ============ -->
      <nav
        *ngIf="totalPages > 1"
        aria-label="Paginación"
        class="flex items-center gap-1"
      >
        <!-- Primera -->
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-square w-8 h-8 border border-base-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-base-200 disabled:hover:text-base-content transition"
          [disabled]="page === 0"
          (click)="goToPage(0)"
          aria-label="Primera página"
          title="Primera página"
        >
          <i class="fa-solid fa-angles-left text-[10px]" aria-hidden="true"></i>
        </button>

        <!-- Anterior -->
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-square w-8 h-8 border border-base-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-base-200 disabled:hover:text-base-content transition"
          [disabled]="page === 0"
          (click)="goToPage(page - 1)"
          aria-label="Página anterior"
          title="Anterior"
        >
          <i class="fa-solid fa-chevron-left text-[10px]" aria-hidden="true"></i>
        </button>

        <!-- Separador visual -->
        <span
          *ngIf="totalPages > 1"
          class="w-px h-5 bg-base-300 mx-0.5"
          aria-hidden="true"
        ></span>

        <!-- Números -->
        <ng-container *ngFor="let p of pageNumbers">
          <span
            *ngIf="p === '…'; else pagina"
            class="flex items-center justify-center w-8 h-8 text-xs opacity-40 select-none"
            aria-hidden="true"
          >
            &hellip;
          </span>

          <ng-template #pagina>
            <button
              type="button"
              class="btn btn-xs w-8 h-8 p-0 border transition"
              [ngClass]="
                p === page + 1
                  ? 'btn-primary border-primary text-white shadow-sm hover:brightness-110'
                  : 'btn-ghost border-base-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
              "
              [attr.aria-current]="p === page + 1 ? 'page' : null"
              [attr.aria-label]="'Ir a la página ' + p"
              (click)="goToPage(toIndex(p))"
            >
              {{ p }}
            </button>
          </ng-template>
        </ng-container>

        <!-- Separador visual -->
        <span
          *ngIf="totalPages > 1"
          class="w-px h-5 bg-base-300 mx-0.5"
          aria-hidden="true"
        ></span>

        <!-- Siguiente -->
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-square w-8 h-8 border border-base-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-base-200 disabled:hover:text-base-content transition"
          [disabled]="page >= totalPages - 1"
          (click)="goToPage(page + 1)"
          aria-label="Página siguiente"
          title="Siguiente"
        >
          <i class="fa-solid fa-chevron-right text-[10px]" aria-hidden="true"></i>
        </button>

        <!-- Última -->
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-square w-8 h-8 border border-base-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-base-200 disabled:hover:text-base-content transition"
          [disabled]="page >= totalPages - 1"
          (click)="goToPage(totalPages - 1)"
          aria-label="Última página"
          title="Última página"
        >
          <i class="fa-solid fa-angles-right text-[10px]" aria-hidden="true"></i>
        </button>
      </nav>
    </div>

  `,
})
export class PaginatorComponent implements OnChanges {
  @Input() total = 0;
  @Input() page = 0;
  @Input() pageSize = 10;
  @Input() pageSizes = [10, 25, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  /** Tamaños del selector; incluye el actual aunque el padre no lo liste. */
  get opciones(): number[] {
    return this.pageSizes.includes(this.pageSize)
      ? this.pageSizes
      : [...this.pageSizes, this.pageSize].sort((x, y) => x - y);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.page * this.pageSize + 1;
  }

  get rangoFin(): number {
    return Math.min((this.page + 1) * this.pageSize, this.total);
  }

  get pageNumbers(): (number | '…')[] {
    const total = this.totalPages;
    const max = 5;
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let desde = this.page - 2;
    if (desde < 0) desde = 0;
    if (desde > total - max) desde = total - max;

    const numeros = Array.from({ length: max }, (_, i) => desde + i + 1);
    const out: (number | '…')[] = [];

    if (desde > 0) {
      out.push(1);
      if (desde > 1) out.push('…');
    }
    out.push(...numeros);
    if (desde + max < total) {
      if (desde + max < total - 1) out.push('…');
      out.push(total);
    }
    return out;
  }

  ngOnChanges(_: SimpleChanges): void {
    if (this.page > this.totalPages - 1) {
      const nueva = Math.max(0, this.totalPages - 1);
      if (nueva !== this.page) {
        this.page = nueva;
        this.pageChange.emit(this.page);
      }
    }
  }

  goToPage(p: number): void {
    if (p < 0 || p >= this.totalPages || p === this.page) return;
    this.pageChange.emit(p);
  }

  toIndex(p: number | '…'): number {
    return typeof p === 'number' ? p - 1 : 0;
  }

  onPageSizeChange(valor: string): void {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return;
    this.pageSizeChange.emit(n);
  }
}
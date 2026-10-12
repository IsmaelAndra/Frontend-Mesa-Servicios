import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  forwardRef,
  inject
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Opción de un dato maestro (tipo de ticket, prioridad, área, categoría,
 * estado...). El icono y el color vienen del propio maestro, no de un mapa.
 */
export interface MasterOption {
  value: unknown;
  label: string;
  icon?: string;
  color?: string;
}

/** Opción con el índice y el id de DOM que necesita la navegación por teclado. */
interface MasterOptionView extends MasterOption {
  viewIndex: number;
  optionId: string;
}

/**
 * Select de dato maestro.
 *
 * Sustituye al <select> nativo porque este no puede pintar nada dentro de las
 * opciones: cada <option> solo admite texto. Como los maestros ya traen
 * `icon_*` y `color_*`, el desplegable debe mostrar el icono de cada opción en
 * su color, y con el nativo no hay manera de hacerlo.
 *
 * Patrón de accesibilidad: combobox "select-only". El foco se queda siempre en
 * el botón disparador y la posición del teclado se comunica con
 * `aria-activedescendant`, de forma que el lector de pantalla anuncia la opción
 * resaltada sin mover el foco dentro de la lista.
 */
@Component({
  selector: 'app-master-select',
  standalone: false,
  template: `
    <div class="relative">
      <button
        #trigger
        type="button"
        role="combobox"
        class="w-full flex items-center gap-2 rounded-btn border border-base-300 bg-base-100 px-3 py-2 text-left text-sm
               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary
               disabled:opacity-60 disabled:cursor-not-allowed"
        [class.bg-base-200]="disabled"
        [disabled]="disabled"
        [attr.aria-expanded]="open"
        aria-haspopup="listbox"
        aria-controls="listId"
        [attr.aria-labelledby]="label ? labelId : null"
        [attr.aria-activedescendant]="open && activeId ? activeId : null"
        (click)="toggle()"
      >
        <i
          *ngIf="selected?.icon"
          class="shrink-0 text-sm leading-none"
          [ngClass]="selected!.icon"
          [style.color]="selected!.color || null"
          aria-hidden="true"
        ></i>
        <span
          class="min-w-0 flex-1 truncate"
          [ngClass]="selected ? '' : 'text-base-content/50'"
          [style.color]="selected?.color || null"
        >
          {{ selected ? selected.label : placeholder }}
        </span>
        <i
          class="fa-solid fa-chevron-down text-[10px] opacity-50 shrink-0 transition-transform"
          [class.rotate-180]="open"
          aria-hidden="true"
        ></i>
      </button>

      <span *ngIf="label" [id]="labelId" class="sr-only">{{ label }}</span>

      <div
        *ngIf="open"
        [id]="listId"
        class="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-btn border border-base-300 bg-base-100 shadow-lg py-1"
        role="listbox"
        [attr.aria-labelledby]="label ? labelId : null"
      >
        <div
          *ngFor="let view of viewOptions; trackBy: trackByIndex"
          [id]="view.optionId"
          role="option"
          class="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors"
          [class.bg-base-200]="view.viewIndex === highlighted"
          [attr.aria-selected]="view.value === value"
          (click)="select(view)"
          (mouseenter)="highlight(view.viewIndex)"
        >
          <i
            *ngIf="view.icon"
            class="shrink-0 text-sm leading-none w-4 text-center"
            [ngClass]="view.icon"
            [style.color]="view.color || null"
            aria-hidden="true"
          ></i>
          <span *ngIf="!view.icon" class="shrink-0 w-4" aria-hidden="true"></span>
          <span class="min-w-0 flex-1 truncate" [style.color]="view.color || null">{{ view.label }}</span>
          <i
            *ngIf="view.value === value"
            class="fa-solid fa-check text-[10px] shrink-0"
            [style.color]="view.color || null"
            aria-hidden="true"
          ></i>
        </div>

        <p *ngIf="!viewOptions.length" class="px-3 py-3 text-sm opacity-60 text-center">
          Sin opciones disponibles
        </p>
      </div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MasterSelectComponent),
      multi: true
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MasterSelectComponent implements ControlValueAccessor, OnChanges {
  /** Opciones a listar. Cada una trae icono y color si el maestro los define. */
  @Input() options: MasterOption[] = [];
  /** Texto cuando no hay nada seleccionado. */
  @Input() placeholder = 'Seleccione una opción';
  /** Nombre accesible del campo cuando la etiqueta visible la aporta otro elemento. */
  @Input() label = '';
  @Input() disabled = false;
  /** Muestra la opción "Sin especificar" como primera fila. */
  @Input() allowEmpty = false;
  @Input() emptyLabel = 'Sin especificar';

  value: unknown = null;
  open = false;
  /** Índice de la opción resaltada, ya sea la vacía o una de `options`. */
  highlighted = 0;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly uid = Math.random().toString(36).slice(2, 9);
  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  readonly labelId = `ms-label-${this.uid}`;
  readonly listId = `ms-list-${this.uid}`;

  /** Filas ya construidas. Se recalculan solo cuando cambia la lista de opciones. */
  private _viewOptions: MasterOptionView[] = [];

  /**
   * El catálogo llega asíncrono (viene de /admin/catalog), así que las opciones
   * se rellenan después de crear el componente. Por eso hay que reconstruirlas
   * en ngOnChanges y no solo al inicializar.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] || changes['allowEmpty'] || changes['emptyLabel']) {
      this.rebuild();
      this.cdr.markForCheck();
    }
  }

  /** Identidad estable para el *ngFor: sin esto Angular recrea cada fila. */
  trackByIndex = (index: number, view: MasterOptionView): string => view.optionId;

  private rebuild(): void {
    const rows: MasterOption[] = this.allowEmpty
      ? [{ value: null, label: this.emptyLabel }, ...this.options]
      : this.options;
    this._viewOptions = rows.map((opt, index) => ({
      ...opt,
      viewIndex: index,
      optionId: `ms-opt-${this.uid}-${index}`
    }));
    // El índice resaltado puede quedar fuera si la lista se acortó.
    this.highlighted = Math.min(this.highlighted, Math.max(0, this._viewOptions.length - 1));
  }

  /**
   * Filas navegables. La opción vacía se antepone a `options` para que las
   * flechas también la alcancen; con el <select> nativo "Sin especificar" era
   * alcanzable, así que dejarlo fuera sería una pérdida de accesibilidad.
   *
   * Se cachean en un campo en vez de calcularse en un getter porque se leen en
   * la plantilla: como getter devolvía objetos nuevos en cada lectura, el *ngFor
   * los veía como opciones distintas y las eliminaba y recreaba en cada ciclo de
   * detección. Eso rompía el clic (el mouseup caía en un nodo ya destruido) y
   * entraba en bucle con el mouseenter.
   */
  get viewOptions(): MasterOptionView[] {
    return this._viewOptions;
  }

  /** La opción que coincide con el valor actual, para pintar icono y color. */
  get selected(): MasterOption | null {
    if (this.value === null || this.value === undefined) return null;
    return this.options.find(o => o.value === this.value) ?? null;
  }

  /** Id DOM de la fila resaltada, el que anuncia aria-activedescendant. */
  get activeId(): string | null {
    const view = this.viewOptions[this.highlighted];
    return view ? view.optionId : null;
  }

  writeValue(value: unknown): void {
    this.value = value;
    this.highlighted = this.indexOf(value);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.open = false;
    this.cdr.markForCheck();
  }

  toggle(): void {
    if (this.disabled) return;
    this.open ? this.close() : this.show();
  }

  show(): void {
    this.open = true;
    this.highlighted = this.indexOf(this.value);
    this.cdr.markForCheck();
  }

  close(): void {
    this.open = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  select(view: MasterOptionView): void {
    this.value = view.value;
    this.open = false;
    // Se avisa al formControl aunque el valor no cambie, para que los
    // validators dependientes (por ejemplo, pedir motivo al escalar) se
    // reevalúen también al elegir otra opción de la lista.
    this.onChange(view.value);
    this.onTouched();
    this.cdr.markForCheck();
  }

  highlight(index: number): void {
    this.highlighted = index;
  }

  /** Cierra al pulsar fuera del componente. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    const target = event.target as HTMLElement | null;
    const host = target?.closest('app-master-select');
    // Se busca por etiqueta porque el componente usa ViewEncapsulation por
    // defecto y su <div> interno no es referenciable desde fuera.
    if (!host) this.close();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case 'Escape':
        if (this.open) {
          event.stopPropagation();
          this.close();
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open) {
          this.show();
        } else {
          const view = this.viewOptions[this.highlighted];
          if (view) this.select(view);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.open ? this.move(1) : this.show();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.open ? this.move(-1) : this.show();
        break;
      case 'Home':
        if (this.open) {
          event.preventDefault();
          this.highlighted = 0;
          this.cdr.markForCheck();
        }
        break;
      case 'End':
        if (this.open) {
          event.preventDefault();
          this.highlighted = Math.max(0, this.viewOptions.length - 1);
          this.cdr.markForCheck();
        }
        break;
      case 'Tab':
        // Tab debe salir del campo, no recorrer la lista.
        if (this.open) this.close();
        break;
      default:
        break;
    }
  }

  private indexOf(value: unknown): number {
    const views = this.viewOptions;
    const index = views.findIndex(v => v.value === value);
    return index >= 0 ? index : 0;
  }

  private move(delta: number): void {
    const total = this.viewOptions.length;
    if (!total) return;
    const next = this.highlighted + delta;
    this.highlighted = next < 0
      ? total - 1
      : next >= total ? 0 : next;
    this.cdr.markForCheck();
  }
}
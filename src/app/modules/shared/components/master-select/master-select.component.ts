import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  forwardRef,
  inject
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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

      <!--
        La lista se mueve al <body> al abrirse y se coloca con position: fixed
        junto al botón (ver "panel" y posicionar()). Antes era absolute dentro
        del componente y cualquier tarjeta o modal con overflow la recortaba:
        quedaba "por detrás" y no se podía elegir.
      -->
      <div
        #panel
        *ngIf="open"
        [id]="listId"
        class="master-select-panel max-h-60 overflow-y-auto rounded-btn border border-base-300 bg-base-100 shadow-lg py-1"
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
export class MasterSelectComponent implements ControlValueAccessor, OnChanges, OnDestroy {
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
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);

  @ViewChild('trigger', { static: true }) private trigger?: ElementRef<HTMLButtonElement>;

  /** Lista abierta, ya movida al <body>. */
  private panelEl: HTMLElement | null = null;
  /** Recoloca la lista al hacer scroll en cualquier contenedor o al redimensionar. */
  private readonly alMoverse = () => this.posicionar();

  /**
   * Al aparecer la lista (*ngIf) se saca al <body>: ahí ningún antepasado con
   * overflow ni transform (tarjetas, modal-box de daisyUI) puede recortarla ni
   * cambiar la referencia de position: fixed.
   */
  @ViewChild('panel')
  private set panel(ref: ElementRef<HTMLElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.panelEl) return;
    this.quitarPanel();
    if (!el) return;
    this.panelEl = el;
    this.document.body.appendChild(el);
    this.posicionar();
    this.zone.runOutsideAngular(() => {
      // capture: el scroll de un contenedor interno no burbujea hasta window.
      this.document.addEventListener('scroll', this.alMoverse, true);
      window.addEventListener('resize', this.alMoverse);
    });
  }
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
    const target = event.target as Node | null;
    // La lista vive en el <body>, fuera del componente: un clic en ella no es
    // "fuera". Tampoco lo es un clic en el propio botón (lo gestiona toggle()).
    if (target && (this.panelEl?.contains(target) || this.trigger?.nativeElement.contains(target))) return;
    this.close();
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

  ngOnDestroy(): void {
    this.quitarPanel();
  }

  /**
   * Coloca la lista pegada al botón, con su mismo ancho. Si debajo no cabe y
   * arriba hay más sitio, se abre hacia arriba (campos al final de un modal).
   */
  private posicionar(): void {
    const panel = this.panelEl;
    const boton = this.trigger?.nativeElement;
    if (!panel || !boton) return;
    const r = boton.getBoundingClientRect();
    const margen = 4;
    const alto = Math.min(panel.scrollHeight || 240, 240);
    const abajo = window.innerHeight - r.bottom;
    const haciaArriba = abajo < alto + margen * 2 && r.top > abajo;

    panel.style.position = 'fixed';
    panel.style.zIndex = '1100'; // por encima del modal de daisyUI (999)
    panel.style.left = `${Math.max(margen, r.left)}px`;
    panel.style.width = `${r.width}px`;
    panel.style.top = haciaArriba ? `${Math.max(margen, r.top - alto - margen)}px` : `${r.bottom + margen}px`;
  }

  private quitarPanel(): void {
    if (!this.panelEl) return;
    this.document.removeEventListener('scroll', this.alMoverse, true);
    window.removeEventListener('resize', this.alMoverse);
    this.panelEl.remove();
    this.panelEl = null;
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
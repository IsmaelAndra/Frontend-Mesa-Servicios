import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Interruptor Activo / Inactivo de los formularios de administración.
 *
 * Cada pantalla lo resolvía a su manera (un select con dos opciones, un
 * checkbox suelto o un toggle), así que el mismo dato se veía distinto según
 * dónde se editara. Este control es el único diseño: badge con icono y color
 * del estado + interruptor, a la altura de los inputs `-sm`.
 */
@Component({
  selector: 'app-estado-activo',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => EstadoActivoComponent), multi: true }
  ],
  template: `
    <button
      type="button"
      role="switch"
      class="w-full min-h-8 flex items-center gap-2.5 rounded-btn border px-2.5 py-1 text-left transition-colors
             focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
      [style.border-color]="color + '66'"
      [style.background-color]="color + '14'"
      [attr.aria-checked]="valor"
      [attr.aria-label]="(etiqueta || 'Estado') + ': ' + texto"
      [disabled]="disabled"
      (click)="cambiar()"
    >
      <span
        class="badge badge-sm kanban-tag border gap-1 font-semibold whitespace-nowrap shrink-0"
        [style.background-color]="color + '1F'"
        [style.border-color]="color"
        [style.color]="color"
        [style.--bc]="color"
      >
        <i class="fa-solid text-[10px]" [ngClass]="valor ? 'fa-circle-check' : 'fa-circle-pause'" aria-hidden="true"></i>
        {{ texto }}
      </span>
      <span *ngIf="descripcion" class="flex-1 min-w-0 text-xs opacity-70 truncate" [title]="descripcion">{{ descripcion }}</span>
      <span *ngIf="!descripcion" class="flex-1"></span>
      <input
        type="checkbox"
        class="toggle toggle-sm toggle-success shrink-0 pointer-events-none"
        [checked]="valor"
        tabindex="-1"
        aria-hidden="true"
      />
    </button>
  `
})
export class EstadoActivoComponent implements ControlValueAccessor {
  /** "Activa"/"Inactiva" (área, sede, regla, política) en lugar de "Activo"/"Inactivo". */
  @Input() femenino = false;
  /** Texto corto que explica qué implica el estado (opcional). */
  @Input() descripcion = '';
  /** Nombre accesible del campo. */
  @Input() etiqueta = '';

  valor = true;
  disabled = false;
  private onChange: (v: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private cdr: ChangeDetectorRef) {}

  get texto(): string {
    if (this.valor) return this.femenino ? 'Activa' : 'Activo';
    return this.femenino ? 'Inactiva' : 'Inactivo';
  }

  get color(): string {
    return this.valor ? '#16A34A' : '#64748B';
  }

  cambiar(): void {
    if (this.disabled) return;
    this.valor = !this.valor;
    this.onChange(this.valor);
    this.onTouched();
  }

  writeValue(v: unknown): void {
    // Un registro nuevo sin valor nace activo, igual que en el backend.
    // (Los formularios de alta inicializan el campo a true.)
    this.valor = v === null || v === undefined ? true : !!v;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(d: boolean): void {
    this.disabled = d;
    this.cdr.markForCheck();
  }
}

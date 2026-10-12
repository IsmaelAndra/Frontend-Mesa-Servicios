import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject
} from '@angular/core';

/**
 * Zona para subir archivos: clic para elegir o arrastrar y soltar.
 *
 * Sustituye a los <input type="file"> y botones "Seleccionar" sueltos que había
 * en cada pantalla (nuevo ticket, adjuntos, marca, plantillas…), para que todas
 * suban archivos igual.
 *
 * Salidas:
 * - `archivos`: los archivos aceptados (File[]). Es la que deben usar los
 *   componentes nuevos.
 * - `cambio`: los mismos archivos con forma de evento `change` de un input
 *   (`event.target.files`, `event.target.value`). Existe para que los manejadores
 *   que ya leían `(change)="onXSelected($event)"` sigan funcionando sin tocarlos.
 * - `rechazados`: nombres de los archivos que no cumplen `accept`. Al soltar,
 *   el navegador no filtra por `accept` como sí hace el diálogo de archivos.
 */
@Component({
  selector: 'app-dropzone',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      [attr.for]="inputId"
      class="dropzone"
      [class.dropzone--compacta]="compacta"
      [class.dropzone--activa]="arrastrando"
      [class.dropzone--deshabilitada]="disabled"
      tabindex="0"
      role="button"
      [attr.aria-disabled]="disabled || null"
      [attr.aria-describedby]="hint ? hintId : null"
      (keydown.enter)="abrir($event)"
      (keydown.space)="abrir($event)"
      (dragenter)="alEntrar($event)"
      (dragover)="alEntrar($event)"
      (dragleave)="alSalir($event)"
      (drop)="alSoltar($event)"
    >
      <span class="dropzone__icono" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"
          />
        </svg>
      </span>
      <span class="dropzone__textos">
        <span class="dropzone__titulo">
          <ng-container *ngIf="!arrastrando; else soltarAqui">
            <span class="font-semibold text-primary">Haz clic para subir</span> o arrastra y suelta
          </ng-container>
          <ng-template #soltarAqui>
            <span class="font-semibold text-primary">Suelta {{ multiple ? 'los archivos' : 'el archivo' }} aquí</span>
          </ng-template>
        </span>
        <span *ngIf="hint" [id]="hintId" class="dropzone__ayuda">{{ hint }}</span>
      </span>
      <input
        #input
        [id]="inputId"
        type="file"
        class="hidden"
        [attr.accept]="accept || null"
        [multiple]="multiple"
        [disabled]="disabled"
        (change)="alElegir()"
      />
    </label>
  `,
  styles: [`
    :host { display: block; }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      min-height: 11rem;
      padding: 1.5rem 1rem;
      text-align: center;
      cursor: pointer;
      border: 1.5px dashed oklch(var(--bc) / 0.22);
      border-radius: var(--rounded-box, 1rem);
      background: oklch(var(--b2) / 0.45);
      color: oklch(var(--bc) / 0.75);
      transition: background-color 150ms ease, border-color 150ms ease, transform 160ms ease-out;
    }
    .dropzone:hover {
      background: oklch(var(--b2) / 0.9);
      border-color: oklch(var(--p) / 0.45);
    }
    .dropzone:active { transform: scale(0.99); }
    .dropzone:focus-visible {
      outline: 2px solid oklch(var(--p));
      outline-offset: 2px;
    }
    .dropzone--activa {
      background: oklch(var(--p) / 0.08);
      border-color: oklch(var(--p));
      border-style: solid;
    }
    .dropzone--deshabilitada {
      opacity: 0.55;
      cursor: not-allowed;
      pointer-events: none;
    }
    .dropzone__icono {
      display: inline-flex;
      color: oklch(var(--p));
    }
    .dropzone__icono svg { width: 2rem; height: 2rem; }
    .dropzone--activa .dropzone__icono svg { animation: dropzone-sube 700ms ease-in-out infinite alternate; }
    .dropzone__textos { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
    .dropzone__titulo { font-size: 0.875rem; }
    .dropzone__ayuda { font-size: 0.75rem; color: oklch(var(--bc) / 0.55); }

    /* Compacta: en fila, para huecos pequeños (logos, imágenes, plantillas). */
    .dropzone--compacta {
      flex-direction: row;
      justify-content: flex-start;
      min-height: 4.5rem;
      padding: 0.85rem 1rem;
      text-align: left;
    }
    .dropzone--compacta .dropzone__icono svg { width: 1.6rem; height: 1.6rem; }
    .dropzone--compacta .dropzone__titulo { font-size: 0.8rem; }
    .dropzone--compacta .dropzone__ayuda { font-size: 0.7rem; }

    @keyframes dropzone-sube { to { transform: translateY(-3px); } }
    @media (prefers-reduced-motion: reduce) {
      .dropzone, .dropzone--activa .dropzone__icono svg { transition: none; animation: none; }
    }
  `]
})
export class DropzoneComponent {
  /** Igual que el atributo accept del input: ".pdf,.png" o "image/png,image/jpeg". */
  @Input() accept = '';
  @Input() multiple = false;
  /** Texto pequeño bajo el título: tipos y tamaño permitidos. */
  @Input() hint = '';
  /** Versión en fila y más baja, para tarjetas pequeñas. */
  @Input() compacta = false;
  @Input() disabled = false;

  @Output() archivos = new EventEmitter<File[]>();
  @Output() cambio = new EventEmitter<Event>();
  @Output() rechazados = new EventEmitter<string[]>();

  @ViewChild('input', { static: true }) private input!: ElementRef<HTMLInputElement>;

  arrastrando = false;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly uid = Math.random().toString(36).slice(2, 9);
  readonly inputId = `dropzone-${this.uid}`;
  readonly hintId = `dropzone-ayuda-${this.uid}`;

  abrir(ev: Event): void {
    ev.preventDefault();
    if (!this.disabled) this.input.nativeElement.click();
  }

  alElegir(): void {
    const el = this.input.nativeElement;
    this.entregar(Array.from(el.files || []));
    // Se vacía para que elegir otra vez el mismo archivo vuelva a disparar change.
    el.value = '';
  }

  alEntrar(ev: DragEvent): void {
    if (this.disabled || !ev.dataTransfer?.types?.includes('Files')) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    if (!this.arrastrando) {
      this.arrastrando = true;
      this.cdr.markForCheck();
    }
  }

  alSalir(ev: DragEvent): void {
    // dragleave también salta al pasar sobre un hijo: solo cuenta si sale del todo.
    const destino = ev.relatedTarget as Node | null;
    if (destino && (ev.currentTarget as HTMLElement).contains(destino)) return;
    this.arrastrando = false;
    this.cdr.markForCheck();
  }

  alSoltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando = false;
    this.cdr.markForCheck();
    if (this.disabled) return;
    const soltados = Array.from(ev.dataTransfer?.files || []);
    const validos = soltados.filter(f => this.cumpleAccept(f));
    const fuera = soltados.filter(f => !validos.includes(f)).map(f => f.name);
    if (fuera.length) this.rechazados.emit(fuera);
    this.entregar(this.multiple ? validos : validos.slice(0, 1));
  }

  private entregar(lista: File[]): void {
    if (!lista.length) return;
    this.archivos.emit(lista);
    // Forma de evento change: los manejadores antiguos leen target.files / target.value.
    this.cambio.emit({ target: { files: lista, value: '' } } as unknown as Event);
  }

  /** Mismo criterio que el atributo accept: extensiones, tipos MIME y comodines (image/*). */
  cumpleAccept(f: File): boolean {
    const reglas = this.accept.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
    if (!reglas.length) return true;
    const nombre = f.name.toLowerCase();
    const tipo = (f.type || '').toLowerCase();
    return reglas.some(r =>
      r.startsWith('.') ? nombre.endsWith(r)
        : r.endsWith('/*') ? tipo.startsWith(r.slice(0, -1))
          : tipo === r
    );
  }
}

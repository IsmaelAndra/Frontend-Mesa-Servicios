import { Component, ElementRef, HostListener, Input, ViewChild, forwardRef } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Iconos de Font Awesome que se ofrecen para áreas, categorías, equipos... */
export const ICONOS_SELECCIONABLES: { clase: string; nombre: string }[] = [
  { clase: 'fa-solid fa-building', nombre: 'edificio' },
  { clase: 'fa-solid fa-building-columns', nombre: 'institución banco' },
  { clase: 'fa-solid fa-landmark', nombre: 'gerencia dirección' },
  { clase: 'fa-solid fa-sitemap', nombre: 'organigrama estructura' },
  { clase: 'fa-solid fa-users', nombre: 'personas equipo' },
  { clase: 'fa-solid fa-user-tie', nombre: 'jefe ejecutivo' },
  { clase: 'fa-solid fa-people-group', nombre: 'talento humano personal' },
  { clase: 'fa-solid fa-headset', nombre: 'atención soporte' },
  { clase: 'fa-solid fa-laptop-code', nombre: 'tecnología desarrollo' },
  { clase: 'fa-solid fa-code', nombre: 'desarrollo programación' },
  { clase: 'fa-solid fa-server', nombre: 'servidor infraestructura' },
  { clase: 'fa-solid fa-network-wired', nombre: 'red redes' },
  { clase: 'fa-solid fa-shield-halved', nombre: 'seguridad riesgo' },
  { clase: 'fa-solid fa-lock', nombre: 'seguridad acceso' },
  { clase: 'fa-solid fa-database', nombre: 'base de datos' },
  { clase: 'fa-solid fa-desktop', nombre: 'computador equipo' },
  { clase: 'fa-solid fa-print', nombre: 'impresora' },
  { clase: 'fa-solid fa-phone', nombre: 'teléfono telefonía' },
  { clase: 'fa-solid fa-envelope', nombre: 'correo' },
  { clase: 'fa-solid fa-coins', nombre: 'finanzas dinero' },
  { clase: 'fa-solid fa-sack-dollar', nombre: 'tesorería dinero' },
  { clase: 'fa-solid fa-hand-holding-dollar', nombre: 'crédito préstamo' },
  { clase: 'fa-solid fa-piggy-bank', nombre: 'ahorro captaciones' },
  { clase: 'fa-solid fa-calculator', nombre: 'contabilidad' },
  { clase: 'fa-solid fa-file-invoice-dollar', nombre: 'facturación cobranza' },
  { clase: 'fa-solid fa-chart-line', nombre: 'negocios indicadores' },
  { clase: 'fa-solid fa-chart-pie', nombre: 'reportes estadística' },
  { clase: 'fa-solid fa-scale-balanced', nombre: 'legal jurídico cumplimiento' },
  { clase: 'fa-solid fa-gavel', nombre: 'legal' },
  { clase: 'fa-solid fa-magnifying-glass-chart', nombre: 'auditoría' },
  { clase: 'fa-solid fa-clipboard-check', nombre: 'calidad control' },
  { clase: 'fa-solid fa-bullhorn', nombre: 'marketing comunicación' },
  { clase: 'fa-solid fa-handshake', nombre: 'comercial socios' },
  { clase: 'fa-solid fa-store', nombre: 'agencia sucursal' },
  { clase: 'fa-solid fa-truck', nombre: 'logística' },
  { clase: 'fa-solid fa-boxes-stacked', nombre: 'bodega inventario' },
  { clase: 'fa-solid fa-screwdriver-wrench', nombre: 'mantenimiento' },
  { clase: 'fa-solid fa-broom', nombre: 'servicios generales limpieza' },
  { clase: 'fa-solid fa-graduation-cap', nombre: 'capacitación educación' },
  { clase: 'fa-solid fa-heart-pulse', nombre: 'salud médico' },
  { clase: 'fa-solid fa-folder-open', nombre: 'archivo documentos' },
  { clase: 'fa-solid fa-file-signature', nombre: 'firma contratos' },
  { clase: 'fa-solid fa-ticket', nombre: 'ticket' },
  { clase: 'fa-solid fa-bug', nombre: 'error incidente' },
  { clase: 'fa-solid fa-key', nombre: 'clave contraseña' },
  { clase: 'fa-solid fa-wifi', nombre: 'wifi internet' },
  { clase: 'fa-solid fa-cloud', nombre: 'nube' },
  { clase: 'fa-solid fa-gear', nombre: 'configuración' },
  { clase: 'fa-solid fa-bolt', nombre: 'urgente rayo' },
  { clase: 'fa-solid fa-star', nombre: 'estrella' },
  { clase: 'fa-solid fa-flag', nombre: 'bandera' },
  { clase: 'fa-solid fa-circle-question', nombre: 'ayuda consulta' },
  { clase: 'fa-solid fa-tag', nombre: 'etiqueta categoría' },
  { clase: 'fa-solid fa-tags', nombre: 'etiquetas categorías' },
  { clase: 'fa-solid fa-city', nombre: 'ciudad sucursal' },
  { clase: 'fa-solid fa-location-dot', nombre: 'ubicación sucursal' },
  { clase: 'fa-solid fa-clock', nombre: 'reloj sla tiempo' },
  { clase: 'fa-solid fa-stopwatch', nombre: 'cronómetro sla' },
  { clase: 'fa-solid fa-hourglass-half', nombre: 'reloj de arena plazo' },
  { clase: 'fa-solid fa-gears', nombre: 'procesos engranajes' },
  { clase: 'fa-solid fa-users-gear', nombre: 'administración de personal' },
  { clase: 'fa-solid fa-file-invoice', nombre: 'factura' },
  { clase: 'fa-solid fa-bell', nombre: 'aviso notificación' },
  { clase: 'fa-solid fa-comments', nombre: 'chat mensajes' },
  { clase: 'fa-solid fa-triangle-exclamation', nombre: 'alerta advertencia' },
  { clase: 'fa-solid fa-circle-check', nombre: 'resuelto listo' },
  { clase: 'fa-solid fa-user-plus', nombre: 'alta usuario' },
  { clase: 'fa-solid fa-laptop', nombre: 'laptop portátil' },
];

/**
 * Selector visual de iconos (Font Awesome). Botón con el icono elegido; al
 * pulsarlo, una rejilla con buscador. La rejilla se coloca con position: fixed
 * para que no la recorte una tarjeta con overflow (patrón de app-master-select).
 */
@Component({
  selector: 'app-selector-icono',
  standalone: true,
  imports: [NgIf, NgFor],
  template: `
    <button #boton type="button" class="input input-bordered input-sm w-full flex items-center gap-2 text-left"
            (click)="alternar()" [attr.aria-expanded]="abierto" aria-haspopup="dialog" [disabled]="disabled">
      <span class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            [style.background-color]="color + '22'" [style.color]="color" aria-hidden="true">
        <i [class]="valor || 'fa-solid fa-building'"></i>
      </span>
      <span class="flex-1 truncate text-xs opacity-70">{{ etiquetaActual() }}</span>
      <i class="fa-solid fa-chevron-down text-[10px] opacity-60" aria-hidden="true"></i>
    </button>
    <div *ngIf="abierto" class="selector-icono-panel bg-base-100 border border-base-300 rounded-xl shadow-xl p-2"
         role="dialog" aria-label="Elegir icono" [style.top.px]="top" [style.left.px]="left" (click)="$event.stopPropagation()">
      <input #buscador class="input input-bordered input-xs w-full mb-2" placeholder="Buscar icono…"
             [value]="filtro" (input)="filtro = $any($event.target).value" aria-label="Buscar icono" />
      <div class="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto overflow-x-hidden pr-1">
        <button *ngFor="let i of filtrados()" type="button" (click)="elegir(i.clase)" [title]="i.nombre"
                class="selector-icono-op w-full aspect-square rounded-lg flex items-center justify-center hover:bg-base-200"
                [class.ring-2]="i.clase === valor" [class.ring-primary]="i.clase === valor"
                [attr.aria-label]="i.nombre" [attr.aria-pressed]="i.clase === valor">
          <i [class]="i.clase" aria-hidden="true"></i>
        </button>
        <p *ngIf="!filtrados().length" class="col-span-7 text-xs opacity-60 text-center py-3">Sin coincidencias</p>
      </div>
      <!-- Cualquier icono de Font Awesome que no esté en la lista -->
      <div class="mt-2 pt-2 border-t border-base-200">
        <p class="text-[11px] opacity-60 mb-1">¿No está? Escriba la clase de Font Awesome:</p>
        <div class="flex items-center gap-1.5">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-base-300"
                [style.color]="color" aria-hidden="true">
            <i *ngIf="claseValida(propio)" [class]="propio"></i>
            <i *ngIf="!claseValida(propio)" class="fa-regular fa-circle-question opacity-40"></i>
          </span>
          <input class="input input-bordered input-xs flex-1 font-mono" placeholder="fa-solid fa-rocket"
                 [value]="propio" (input)="propio = $any($event.target).value"
                 (keydown.enter)="$event.preventDefault(); usarPropio()" aria-label="Clase del icono" />
          <button type="button" class="btn btn-primary btn-xs" (click)="usarPropio()" [disabled]="!claseValida(propio)">Usar</button>
        </div>
        <p *ngIf="propio && !claseValida(propio)" class="text-[10px] text-error mt-1">
          Forma: fa-solid fa-nombre (también fa-regular o fa-brands)
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .selector-icono-panel { position: fixed; z-index: 1100; width: 19rem; max-width: calc(100vw - 1rem);
      animation: selector-icono-entra 150ms cubic-bezier(0.23, 1, 0.32, 1) both; transform-origin: top left; }
    @keyframes selector-icono-entra { from { opacity: 0; transform: scale(0.97) translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .selector-icono-panel { animation-duration: 1ms; } }
  `],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorIconoComponent), multi: true }],
})
export class SelectorIconoComponent implements ControlValueAccessor {
  /** Color con el que se pinta la vista previa (el del área, categoría...). */
  @Input() color = '#062e86';
  @ViewChild('boton') boton?: ElementRef<HTMLButtonElement>;

  valor = '';
  /** Clase escrita a mano (icono que no está en la lista). */
  propio = '';
  abierto = false;
  disabled = false;
  filtro = '';
  top = 0;
  left = 0;

  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>) {}

  writeValue(v: string | null): void { this.valor = v || ''; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled = d; }

  etiquetaActual(): string {
    const i = ICONOS_SELECCIONABLES.find((x) => x.clase === this.valor);
    // Un icono que no está en la lista se muestra por su nombre corto ("fa-gauge").
    return i ? i.nombre : this.valor ? this.valor.replace(/^fa-(solid|regular|brands)\s+/, '') : 'Elegir icono';
  }

  filtrados(): { clase: string; nombre: string }[] {
    const f = this.filtro.trim().toLowerCase();
    return f ? ICONOS_SELECCIONABLES.filter((i) => i.nombre.includes(f) || i.clase.includes(f)) : ICONOS_SELECCIONABLES;
  }

  alternar(): void {
    if (this.abierto) { this.cerrar(); return; }
    const r = this.boton?.nativeElement.getBoundingClientRect();
    if (r) {
      const alto = 380;
      this.left = Math.max(8, Math.min(r.left, window.innerWidth - 312));
      this.top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto - 4) : r.bottom + 4;
    }
    this.filtro = '';
    // Si el icono actual no está en la lista, se muestra en el campo para editarlo.
    this.propio = this.valor && !ICONOS_SELECCIONABLES.some((i) => i.clase === this.valor) ? this.valor : '';
    this.abierto = true;
  }

  /** La misma forma que acepta el backend (AdminService.ICONO_FA). */
  claseValida(c: string): boolean {
    return /^fa-(solid|regular|brands) fa-[a-z0-9-]+$/.test((c || '').trim());
  }

  usarPropio(): void {
    const c = this.propio.trim().replace(/\s+/g, ' ');
    if (this.claseValida(c)) this.elegir(c);
  }

  elegir(clase: string): void {
    this.valor = clase;
    this.onChange(clase);
    this.onTouched();
    this.cerrar();
    this.boton?.nativeElement.focus();
  }

  cerrar(): void { this.abierto = false; }

  @HostListener('document:click', ['$event'])
  fuera(e: MouseEvent): void {
    if (this.abierto && !this.host.nativeElement.contains(e.target as Node)) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  escape(): void { this.cerrar(); }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  alMover(): void { if (this.abierto) this.cerrar(); }
}

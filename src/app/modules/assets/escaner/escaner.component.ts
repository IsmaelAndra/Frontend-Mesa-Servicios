import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AssetService } from '../../../core/services/asset.service';

/** Lo mínimo de la API BarcodeDetector del navegador (Chrome/Edge en Android y escritorio). */
interface DetectorDeCodigos {
  detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = new (opciones: { formats: string[] }) => DetectorDeCodigos;

/**
 * Escáner de activos con la cámara. Usa BarcodeDetector del navegador (lee el
 * Code 128 de las etiquetas); donde no existe (Safari, Firefox) queda el campo
 * para escribir el código, que también sirve con una pistola lectora USB (escribe
 * el código y pulsa Enter). Al encontrar el activo, abre su ficha.
 */
@Component({
  selector: 'app-escaner',
  template: `
    <div class="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4" (click)="cerrar()">
      <div class="overlay-panel bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
           role="dialog" aria-modal="true" aria-labelledby="titulo-escaner" (click)="$event.stopPropagation()">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-base-200">
          <i class="fa-solid fa-barcode text-primary text-xl" aria-hidden="true"></i>
          <h3 id="titulo-escaner" class="font-bold flex-1">Escanear activo</h3>
          <button type="button" class="btn btn-ghost btn-sm btn-circle" (click)="cerrar()" aria-label="Cerrar">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div *ngIf="conCamara" class="relative bg-black aspect-[4/3]">
          <video #video class="w-full h-full object-cover" playsinline muted></video>
          <div class="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-white/80 rounded-xl pointer-events-none" aria-hidden="true"></div>
        </div>
        <div class="p-4 space-y-3">
          <p *ngIf="!conCamara" class="text-sm opacity-75">
            <i class="fa-solid fa-circle-info mr-1" aria-hidden="true"></i>{{ motivoSinCamara }}
          </p>
          <p *ngIf="conCamara" class="text-xs opacity-70 text-center">Apunte a la etiqueta del equipo.</p>
          <form class="flex gap-2" (ngSubmit)="buscar(codigo)">
            <input class="input input-bordered input-sm flex-1 font-mono" name="codigo" [(ngModel)]="codigo"
                   placeholder="O escriba el código (TI-LAP-000123)" autocomplete="off" aria-label="Código del activo" />
            <button type="submit" class="btn btn-primary btn-sm text-white" [disabled]="!codigo.trim() || buscando">Buscar</button>
          </form>
          <p *ngIf="error" class="text-sm text-error">{{ error }}</p>
        </div>
      </div>
    </div>
  `,
})
export class EscanerComponent implements AfterViewInit, OnDestroy {
  @Output() cerrado = new EventEmitter<void>();
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  conCamara = false;
  motivoSinCamara = 'Este navegador no lee códigos de barras con la cámara: escriba el código o use una pistola lectora.';
  codigo = '';
  error = '';
  buscando = false;
  private stream: MediaStream | null = null;
  private activo = true;

  constructor(private assetService: AssetService, private router: Router) {
    const D = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
    this.conCamara = !!D && !!navigator.mediaDevices?.getUserMedia;
  }

  ngAfterViewInit(): void {
    if (this.conCamara) setTimeout(() => this.iniciar());
  }

  ngOnDestroy(): void {
    this.detener();
  }

  private async iniciar(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = this.video?.nativeElement;
      if (!v) return;
      v.srcObject = this.stream;
      await v.play();
      const D = (window as unknown as { BarcodeDetector: ConstructorDetector }).BarcodeDetector;
      const detector = new D({ formats: ['code_128', 'code_39', 'qr_code', 'ean_13'] });
      const leer = async () => {
        if (!this.activo || this.buscando) return;
        try {
          const r = await detector.detect(v);
          if (r.length && r[0].rawValue) {
            this.buscar(r[0].rawValue);
            return;
          }
        } catch {
          // Un cuadro que no se pudo leer: se intenta con el siguiente.
        }
        setTimeout(leer, 250);
      };
      leer();
    } catch (e) {
      this.conCamara = false;
      const nombre = (e as { name?: string } | null)?.name;
      // Un mensaje que diga qué hacer: antes siempre era el mismo.
      this.motivoSinCamara = !window.isSecureContext
        ? 'La cámara solo funciona con https://: abra el sistema con su dirección segura o escriba el código.'
        : nombre === 'NotAllowedError' || nombre === 'SecurityError'
          ? 'El navegador tiene bloqueada la cámara para este sitio. Toque el candado junto a la dirección → Permisos → Cámara → Permitir, y vuelva a abrir el escáner. Mientras tanto, escriba el código.'
          : nombre === 'NotFoundError' || nombre === 'OverconstrainedError'
            ? 'No se encontró una cámara en este equipo: escriba el código.'
            : 'No se pudo abrir la cámara (puede estar en uso por otra aplicación): escriba el código.';
    }
  }

  buscar(codigo: string): void {
    const c = (codigo || '').trim();
    if (!c || this.buscando) return;
    this.buscando = true;
    this.error = '';
    this.assetService.porCodigo(c).subscribe({
      next: (a) => {
        this.detener();
        this.cerrado.emit();
        this.router.navigate(['/activos', a.idAsset]);
      },
      error: (e) => {
        this.buscando = false;
        this.error = e?.status === 404 ? `No hay un activo con el código ${c}` : 'No se pudo buscar el activo';
        // Sigue leyendo con la cámara.
        if (this.conCamara) setTimeout(() => this.iniciarLecturaDeNuevo(), 1500);
      },
    });
  }

  private iniciarLecturaDeNuevo(): void {
    if (!this.activo) return;
    this.detener();
    this.activo = true;
    this.iniciar();
  }

  private detener(): void {
    this.activo = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  cerrar(): void {
    this.detener();
    this.cerrado.emit();
  }
}

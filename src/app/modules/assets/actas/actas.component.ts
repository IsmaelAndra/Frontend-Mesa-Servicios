import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Acta, ESTADOS_ACTA, TIPOS_ACTA } from '../../../models/asset.model';
import { abrirBlob } from '../../../core/utils/abrir-blob.util';
import { Paginacion } from '../../../core/utils/pagination.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Todas las actas FOR-POL-TIC-01-10 (Tecnología, Desarrollo, súper admin y
 * auditor). Aquí se ve cuáles faltan por aceptar y se sube el escaneo firmado.
 */
@Component({
  selector: 'app-actas',
  templateUrl: './actas.component.html',
})
export class ActasComponent implements OnInit {
  actas: Acta[] = [];
  filtradas: Acta[] = [];
  cargando = true;
  texto = '';
  estado: string | null = null;
  tipo: string | null = null;
  readonly tiposActa = TIPOS_ACTA;
  readonly estadosActa = ESTADOS_ACTA;
  readonly opcionesEstado: MasterOption[] = Object.entries(ESTADOS_ACTA)
    .map(([k, v]) => ({ value: k, label: v.texto, icon: v.icono, color: v.color }));
  readonly opcionesTipo: MasterOption[] = Object.entries(TIPOS_ACTA)
    .map(([k, v]) => ({ value: k, label: v.texto, icon: v.icono, color: v.color }));
  readonly pag = new Paginacion<Acta>(() => this.filtradas);

  constructor(private assetService: AssetService, private authService: AuthService, private toast: ToastService) {}

  get puedeGestionar(): boolean {
    return this.authService.gestionaActivos();
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.assetService.actas().subscribe({
      next: (l) => {
        this.actas = l || [];
        this.filtrar();
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar las actas');
      },
    });
  }

  filtrar(): void {
    const t = this.texto.trim().toLowerCase();
    this.filtradas = this.actas.filter((a) =>
      (!this.estado || a.estado === this.estado)
      && (!this.tipo || a.tipo === this.tipo)
      && (!t || a.numero.toLowerCase().includes(t) || a.custodio.nombre.toLowerCase().includes(t)
        || a.items.some((i) => i.codigo.toLowerCase().includes(t))));
    this.pag.cambiarPagina(0);
  }

  ver(a: Acta): void {
    this.assetService.actaPdf(a.id).subscribe({
      next: (b) => abrirBlob(b, `${a.numero}.pdf`),
      error: () => this.toast.error('No se pudo abrir el acta'),
    });
  }

  verFirmada(a: Acta): void {
    this.assetService.actaFirmada(a.id).subscribe({
      next: (b) => abrirBlob(b, `${a.numero}-firmada`),
      error: () => this.toast.error('No se pudo abrir el acta firmada'),
    });
  }

  subirFirmada(ev: Event, a: Acta): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.assetService.subirActaFirmada(a.id, f).subscribe({
      next: () => {
        this.toast.success(`Acta ${a.numero} firmada guardada`);
        this.cargar();
      },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo subir el acta firmada'),
    });
  }

  trackActa(_: number, a: Acta): string {
    return a.id;
  }
}

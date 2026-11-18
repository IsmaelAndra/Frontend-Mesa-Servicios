import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { SseService } from '../../../core/services/sse.service';

import { AssetService } from '../../../core/services/asset.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Acta, Asset, ESTADOS_ACTA, ESTADOS_FISICOS, TIPOS_ACTA } from '../../../models/asset.model';
import { colorTipoActivo, etiquetaTipoActivo, iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { abrirBlob } from '../../../core/utils/abrir-blob.util';

/**
 * "Mis equipos" (cualquier persona): los equipos que tiene a su nombre y sus
 * actas. Aquí acepta en el sistema que así se le entregó (o que así devolvió):
 * queda la hora y la IP, y Tecnología sube después el acta firmada a mano.
 */
@Component({
  selector: 'app-mis-equipos',
  templateUrl: './mis-equipos.component.html',
})
export class MisEquiposComponent implements OnInit, OnDestroy {
  private cambioSub?: Subscription;
  equipos: Asset[] = [];
  actas: Acta[] = [];
  cargando = true;
  readonly tiposActa = TIPOS_ACTA;
  readonly estadosActa = ESTADOS_ACTA;
  /** Mosaicos de arriba; se recalculan al cargar (no es un getter: lo pinta un ngFor). */
  resumen: { texto: string; valor: number; icono: string; color: string }[] = this.armarResumen();

  constructor(private assetService: AssetService, private authService: AuthService, private toast: ToastService,
              private sse: SseService) {}

  ngOnDestroy(): void {
    this.cambioSub?.unsubscribe();
  }

  ngOnInit(): void {
    // Un acta nueva o subida firmada aparece sin salir y volver a entrar.
    this.cambioSub = this.sse.cambio$.pipe(filter((c) => c.tipo === 'acta'), debounceTime(400))
      .subscribe(() => this.cargar());
    this.assetService.tipos().subscribe({ error: () => undefined });
    this.cargar();
  }

  cargar(): void {
    const yo = this.authService.currentUserSnapshot()?.idUser;
    this.cargando = true;
    this.assetService.actas().subscribe({
      next: (l) => {
        this.actas = (l || []).filter((a) => a.custodio.id === yo || a.custodioAnterior?.id === yo);
        this.resumen = this.armarResumen();
      },
      error: () => (this.actas = []),
    });
    if (!yo) {
      this.cargando = false;
      return;
    }
    this.assetService.findByUser(yo).subscribe({
      next: (l) => {
        this.equipos = l || [];
        this.cargando = false;
        this.resumen = this.armarResumen();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar sus equipos');
      },
    });
  }

  private armarResumen(): { texto: string; valor: number; icono: string; color: string }[] {
    return [
      { texto: 'Equipos a mi nombre', valor: this.equipos?.length ?? 0, icono: 'fa-solid fa-laptop', color: '#2563EB' },
      { texto: 'Actas por firmar', valor: (this.actas || []).filter((a) => a.estado === 'PENDIENTE').length,
        icono: 'fa-solid fa-file-signature', color: '#D97706' },
      { texto: 'Actas firmadas', valor: (this.actas || []).filter((a) => a.estado === 'FIRMADA').length,
        icono: 'fa-solid fa-circle-check', color: '#16A34A' },
      { texto: 'Garantías por vencer (60 días)', valor: (this.equipos || []).filter((e) => this.garantiaPorVencer(e)).length,
        icono: 'fa-solid fa-shield-halved', color: '#DC2626' },
    ];
  }

  /** "yyyy-MM-dd" como día local (new Date('2026-12-01') en UTC-5 daba el día anterior). */
  fechaLocal(v?: string | null): Date | null {
    if (!v) return null;
    const [y, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  garantiaPorVencer(e: Asset): boolean {
    const f = this.fechaLocal(e.warrantyUntilAsset);
    if (!f) return false;
    const dias = (f.getTime() - Date.now()) / 86_400_000;
    return dias >= 0 && dias <= 60;
  }

  get pendientes(): Acta[] {
    // Ya no se aceptan en el sistema: quedan pendientes hasta que se sube el escaneo firmado.
    return this.actas.filter((a) => a.estado === 'PENDIENTE');
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

  icono(a: Asset): string {
    return iconoTipoActivo(a.assetTypeId || a.typeAsset);
  }

  color(a: Asset): string {
    return colorTipoActivo(a.assetTypeId || a.typeAsset);
  }

  tipo(a: Asset): string {
    return etiquetaTipoActivo(a.assetTypeId || a.typeAsset);
  }

  estadoFisico(v?: string | null) {
    return ESTADOS_FISICOS.find((e) => e.valor === v) ?? ESTADOS_FISICOS[1];
  }

  trackActa(_: number, a: Acta): string {
    return a.id;
  }

  trackEquipo(_: number, a: Asset): string {
    return a.idAsset;
  }
}

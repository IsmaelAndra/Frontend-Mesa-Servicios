import { confirmar } from '../../../core/utils/confirmar.util';
import { Component, OnInit } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { ToastService } from '../../../core/services/toast.service';
import { AssetConfig, AssetTipo } from '../../../models/asset.model';

/**
 * Configuración de activos (Tecnología, Desarrollo y súper admin), en el menú
 * de Administración: el maestro de tipos (con prefijo para el código) y la
 * numeración de códigos y actas (formato nuevo o códigos que ya se tenían).
 */
@Component({
  selector: 'app-configuracion-activos',
  templateUrl: './configuracion-activos.component.html',
})
export class ConfiguracionActivosComponent implements OnInit {
  tipos: AssetTipo[] = [];
  config: AssetConfig | null = null;
  guardandoConfig = false;

  /** Tipo en edición (nuevo si no tiene id). */
  tipo: Partial<AssetTipo> | null = null;
  guardandoTipo = false;
  readonly iconos = [
    'fa-solid fa-laptop', 'fa-solid fa-desktop', 'fa-solid fa-tv', 'fa-solid fa-print', 'fa-solid fa-keyboard',
    'fa-solid fa-computer-mouse', 'fa-solid fa-phone', 'fa-solid fa-mobile-screen', 'fa-solid fa-server',
    'fa-solid fa-network-wired', 'fa-solid fa-car-battery', 'fa-solid fa-video', 'fa-solid fa-tablet-screen-button',
    'fa-solid fa-headset', 'fa-solid fa-camera', 'fa-solid fa-box',
  ];

  constructor(private assetService: AssetService, private toast: ToastService) {}

  ngOnInit(): void {
    this.cargarTipos();
    this.assetService.config().subscribe({ next: (c) => (this.config = c), error: () => undefined });
  }

  private cargarTipos(): void {
    this.assetService.tipos().subscribe({ next: (t) => (this.tipos = t || []), error: () => undefined });
  }

  nuevoTipo(): void {
    this.tipo = { nombre: '', prefijo: '', icono: 'fa-solid fa-box', color: '#2563EB', activo: true };
  }

  editarTipo(t: AssetTipo): void {
    this.tipo = { ...t };
  }

  get tipoValido(): boolean {
    return !!this.tipo?.nombre?.trim() && /^[A-Za-z0-9]{2,10}$/.test(this.tipo?.prefijo || '');
  }

  guardarTipo(): void {
    if (!this.tipo || !this.tipoValido || this.guardandoTipo) return;
    this.guardandoTipo = true;
    this.assetService.guardarTipo(this.tipo.id || null, { ...this.tipo, prefijo: this.tipo.prefijo!.toUpperCase() }).subscribe({
      next: () => {
        this.guardandoTipo = false;
        this.tipo = null;
        this.toast.success('Tipo guardado');
        this.cargarTipos();
      },
      error: (e) => {
        this.guardandoTipo = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar el tipo');
      },
    });
  }

  async eliminarTipo(t: AssetTipo): Promise<void> {
    if (!(await confirmar({ titulo: `¿Eliminar el tipo ${t.nombre}?`, texto: 'Los activos que lo usan lo conservan.' }))) return;
    this.assetService.eliminarTipo(t.id).subscribe({
      next: () => this.cargarTipos(),
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  /** Vista previa del formato mientras se escribe (la definitiva la da el servidor al guardar). */
  ejemplo(formato: string | undefined, prefijo: string, numero: number): string {
    if (!formato) return '';
    return formato.replace('{TIPO}', prefijo).replace('{ANIO}', String(new Date().getFullYear()))
      .replace(/\{NUM(?::(\d{1,2}))?\}/, (_m, n) => String(numero).padStart(Number(n || 1), '0'));
  }

  guardarConfig(): void {
    if (!this.config || this.guardandoConfig) return;
    this.guardandoConfig = true;
    this.assetService.guardarConfig(this.config).subscribe({
      next: (c) => {
        this.config = c;
        this.guardandoConfig = false;
        this.toast.success('Configuración guardada');
      },
      error: (e) => {
        this.guardandoConfig = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar');
      },
    });
  }

  trackTipo(_: number, t: AssetTipo): string {
    return t.id;
  }
}

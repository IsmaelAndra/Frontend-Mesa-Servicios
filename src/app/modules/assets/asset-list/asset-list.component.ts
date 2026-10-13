import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Asset, AssetPage } from '../../../models/asset.model';
import { TIPOS_ACTIVO, etiquetaTipoActivo, iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { ESTADOS_ACTIVO, metaEstadoActivo } from '../../../core/utils/asset-status.util';
import { inicialesDe, urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Listado de activos. Lo que trae lo decide el backend según quién mira
 * (AssetService.alcanceVisible): cada uno sus equipos, el jefe de área los de
 * su área y los administradores todo. Aquí solo cambian textos y filtros.
 */
@Component({
  selector: 'app-asset-list',
  templateUrl: './asset-list.component.html'
})
export class AssetListComponent implements OnInit {
  assets: Asset[] = [];
  loading = true;
  keyword = '';
  status = '';
  type = '';
  areaId: string | null = null;
  role = '';

  page = 0;
  pageSize = 10;
  totalElements = 0;

  /**
   * Opciones de los filtros, calculadas una vez. Como getters se creaban de
   * nuevo en cada ciclo de detección y el desplegable se reconstruía sin parar.
   */
  readonly statusOptions: MasterOption[] = ESTADOS_ACTIVO.map((e) => {
    const m = metaEstadoActivo(e);
    return { value: e, label: m.etiqueta, icon: m.icono, color: m.color };
  });
  readonly typeOptions: MasterOption[] = TIPOS_ACTIVO.map((t) => ({
    value: t,
    label: etiquetaTipoActivo(t),
    icon: iconoTipoActivo(t)
  }));
  areaOptions: MasterOption[] = [];

  /** Fotos de la columna "Asignado a" que no cargaron (se muestran iniciales). */
  private fotosRotas = new Set<string>();

  constructor(
    private assetService: AssetService,
    private authService: AuthService,
    private adminService: AdminService,
    private toastService: ToastService
  ) {
    this.role = this.authService.getRole();
  }

  ngOnInit(): void {
    if (this.esAdmin) {
      this.adminService.catalog().subscribe({
        next: (c) => {
          this.areaOptions = (c?.areas || []).map((a) => ({
            value: a.id,
            label: a.name,
            icon: a.icon,
            color: a.color
          }));
        },
        error: () => undefined
      });
    }
    this.loadAssets();
  }

  get esAdmin(): boolean {
    return this.role === 'SUPER_ADMIN' || this.role === 'ADMIN';
  }

  get esJefeDeArea(): boolean {
    return this.role === 'AREA_MANAGER';
  }

  get puedeGestionar(): boolean {
    return this.esAdmin || this.esJefeDeArea;
  }

  /** Título y subtítulo según el alcance de quien mira. */
  get titulo(): string {
    if (this.esAdmin) return 'Activos de TI';
    if (this.esJefeDeArea) return 'Activos de mi área';
    return 'Mis activos';
  }

  get subtitulo(): string {
    if (this.esAdmin) return 'Inventario completo de equipos, a quién están asignados y dónde están';
    if (this.esJefeDeArea) return 'Equipos de tu área y de las personas de tu área, con quién los tiene';
    return 'Equipos que tienes asignados a tu nombre';
  }

  loadAssets(): void {
    this.loading = true;
    this.assetService.search({
      search: this.keyword.trim() || undefined,
      status: this.status || undefined,
      type: this.type || undefined,
      areaId: this.areaId || undefined,
      page: this.page,
      size: this.pageSize
    }).subscribe({
      next: (p: AssetPage) => {
        this.assets = p.content;
        this.totalElements = p.totalElements;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastService.error('No se pudieron cargar los activos');
      }
    });
  }

  onPageChange(page: number): void {
    this.page = page;
    this.loadAssets();
  }

  onFilterChange(): void {
    this.page = 0;
    this.loadAssets();
  }

  clearFilters(): void {
    this.keyword = '';
    this.status = '';
    this.type = '';
    this.areaId = null;
    this.onFilterChange();
  }

  get hasFilters(): boolean {
    return !!this.keyword.trim() || !!this.status || !!this.type || this.areaId !== null;
  }

  estado(status: string) {
    return metaEstadoActivo(status);
  }

  typeIcon(type?: string | null): string {
    return iconoTipoActivo(type);
  }

  typeLabel(type?: string | null): string {
    return etiquetaTipoActivo(type);
  }

  fotoDe(a: Asset): string | null {
    const url = urlFotoUsuario(a.assignedUserPhotoUrl);
    return url && !this.fotosRotas.has(url) ? url : null;
  }

  fotoRota(a: Asset): void {
    const url = urlFotoUsuario(a.assignedUserPhotoUrl);
    if (url) this.fotosRotas.add(url);
  }

  iniciales(a: Asset): string {
    return inicialesDe(a.assignedUserDisplayName || a.assignedUser);
  }

  trackById(_index: number, asset: Asset): string {
    return asset.idAsset;
  }
}

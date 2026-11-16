import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Asset, AssetPage, TipoActa } from '../../../models/asset.model';
import { abrirBlob } from '../../../core/utils/abrir-blob.util';
import { colorTipoActivo, etiquetaTipoActivo, iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { ESTADOS_ACTIVO, metaEstadoActivo } from '../../../core/utils/asset-status.util';
import { inicialesDe, urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Inventario de activos para Tecnología, Desarrollo, el súper admin (gestionan)
 * y el auditor (solo lee). Los demás ven "Mis equipos" (/activos/mis-equipos).
 * Se pueden elegir varios equipos para imprimir sus etiquetas o entregarlos en
 * una sola acta.
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
  /** Tipos del maestro; el filtro va por nombre (así lo guarda el activo). */
  typeOptions: MasterOption[] = [];

  /** Equipos elegidos (ids) para etiquetas o un acta conjunta. */
  seleccion = new Set<string>();
  private elegidos = new Map<string, Asset>();
  actaTipo: TipoActa | null = null;
  actaActivos: Asset[] = [];
  escaneando = false;
  areaOptions: MasterOption[] = [];

  /** Fotos de la columna "Asignado a" que no cargaron (se muestran iniciales). */
  private fotosRotas = new Set<string>();

  constructor(
    private assetService: AssetService,
    private authService: AuthService,
    private adminService: AdminService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.role = this.authService.getRole();
  }

  ngOnInit(): void {
    // El permiso de activos llega del servidor: tras recargar aún no está.
    this.authService.permisosCargados().pipe(take(1)).subscribe(() => this.iniciar());
  }

  private iniciar(): void {
    // Quien no gestiona ni audita solo tiene sus equipos: su pantalla es otra.
    if (!this.veTodo) {
      this.router.navigate(['/activos/mis-equipos'], { replaceUrl: true });
      return;
    }
    this.assetService.tipos().subscribe({
      next: (t) => (this.typeOptions = (t || []).map((x) => ({
        value: x.nombre.toUpperCase(), label: x.nombre, icon: x.icono || 'fa-solid fa-box', color: x.color || undefined,
      }))),
      error: () => undefined
    });
    if (this.veTodo) {
      this.adminService.catalog().subscribe({
        next: (c) => {
          this.areaOptions = (c?.areas || []).filter((a) => a.status !== false).map((a) => ({
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
    return this.role === 'SUPER_ADMIN';
  }

  get esJefeDeArea(): boolean {
    return this.role === 'AREA_MANAGER';
  }

  /** Tecnología, Desarrollo y el súper admin (permiso del servidor). */
  get puedeGestionar(): boolean {
    return this.authService.gestionaActivos();
  }

  get veTodo(): boolean {
    return this.puedeGestionar || this.role === 'AUDITOR';
  }

  readonly titulo = 'Activos de TI';
  readonly subtitulo = 'Inventario de equipos: quién los tiene, dónde están y sus actas';

  // ------------------------------------------------------------- selección

  alternar(a: Asset, ev: Event): void {
    ev.stopPropagation();
    if (this.seleccion.has(a.idAsset)) {
      this.seleccion.delete(a.idAsset);
      this.elegidos.delete(a.idAsset);
    } else {
      this.seleccion.add(a.idAsset);
      this.elegidos.set(a.idAsset, a);
    }
  }

  alternarPagina(ev: Event): void {
    const marcar = (ev.target as HTMLInputElement).checked;
    for (const a of this.assets) {
      if (marcar) {
        this.seleccion.add(a.idAsset);
        this.elegidos.set(a.idAsset, a);
      } else {
        this.seleccion.delete(a.idAsset);
        this.elegidos.delete(a.idAsset);
      }
    }
  }

  get paginaMarcada(): boolean {
    return this.assets.length > 0 && this.assets.every((a) => this.seleccion.has(a.idAsset));
  }

  limpiarSeleccion(): void {
    this.seleccion.clear();
    this.elegidos.clear();
  }

  /** Solo los equipos en bodega se entregan juntos. */
  get todosEnBodega(): boolean {
    return [...this.elegidos.values()].every((a) => !a.assignedUserId && (a.statusAsset === 'EN_BODEGA' || a.statusAsset === 'DISPONIBLE'));
  }

  imprimirEtiquetas(): void {
    this.assetService.etiquetas([...this.seleccion]).subscribe({
      next: (b) => abrirBlob(b, 'etiquetas-activos.pdf'),
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudieron generar las etiquetas'),
    });
  }

  entregarSeleccion(): void {
    this.actaActivos = [...this.elegidos.values()];
    this.actaTipo = 'ENTREGA';
  }

  actaCerrada(a: unknown): void {
    this.actaTipo = null;
    if (a) {
      this.limpiarSeleccion();
      this.loadAssets();
    }
  }

  tipoColor(type?: string | null): string {
    return colorTipoActivo(type);
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

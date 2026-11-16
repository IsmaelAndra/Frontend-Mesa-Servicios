import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { ToastService } from '../../../core/services/toast.service';
import { AssetAssignableUser, AssetRequest, AssetTipo, ESTADOS_FISICOS } from '../../../models/asset.model';
import { etiquetaTipoActivo, iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { metaEstadoActivo } from '../../../core/utils/asset-status.util';
import { inicialesDe, urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { compararPorNombre } from '../../../core/utils/user-list.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Alta y edición de un activo.
 *
 * El estado del formulario no ofrece "Asignado" ni "En bodega" por separado:
 * los decide la asignación (con persona, asignado; sin ella, en bodega). Aquí
 * solo se elige si está operativo, en reparación o dado de baja. La entrega a
 * una persona se hace con un acta (ficha del activo), no aquí: el formulario
 * solo permite asignar al registrar o al corregir datos.
 * Las fotos y los PDF (garantía, factura) se suben en la ficha, ya creado.
 */
@Component({
  selector: 'app-asset-form',
  templateUrl: './asset-form.component.html'
})
export class AssetFormComponent implements OnInit, OnDestroy {
  id: string | null = null;
  editando = false;
  loading = false;
  guardando = false;
  role = '';

  request: AssetRequest = {
    codeAsset: '',
    nameAsset: '',
    assetTypeId: null,
    statusAsset: 'EN_BODEGA',
    estadoFisicoAsset: 'BUENO',
    descriptionAsset: '',
    ubicacionAsset: '',
    accesoriosAsset: '',
    configuracionAsset: '',
    novedadesAsset: '',
    brandAsset: '',
    modelAsset: '',
    serialNumberAsset: '',
    providerAsset: '',
    notesAsset: '',
    areaId: undefined,
    sucursalId: undefined,
    assignedUserId: undefined
  };

  /** Mismos límites que AssetRequest en el backend: si no, un 400 al guardar. */
  readonly max = { codigo: 50, nombre: 150, marca: 100, modelo: 100, serie: 100, proveedor: 150, url: 500, ubicacion: 300 };

  /** Tipos del maestro (Activos → Configuración). */
  typeOptions: MasterOption[] = [];
  private tipos: AssetTipo[] = [];
  /** Ejemplo del siguiente código automático (configuración de numeración). */
  ejemploCodigo = '';

  readonly estadoFisicoOptions: MasterOption[] = ESTADOS_FISICOS
    .map((e) => ({ value: e.valor, label: e.texto, icon: e.icono, color: e.color }));

  /** "Operativo" cubre asignado y disponible: lo decide tener o no persona. */
  readonly statusOptions: MasterOption[] = [
    { value: 'EN_BODEGA', label: 'Operativo', icon: 'fa-solid fa-circle-check', color: '#059669' },
    { value: 'EN_REPARACION', label: 'En reparación', icon: metaEstadoActivo('EN_REPARACION').icono, color: metaEstadoActivo('EN_REPARACION').color },
    { value: 'BAJA', label: 'Dado de baja', icon: metaEstadoActivo('BAJA').icono, color: metaEstadoActivo('BAJA').color }
  ];

  areaOptions: MasterOption[] = [];
  sucursalOptions: MasterOption[] = [];
  userOptions: MasterOption[] = [];
  private personas: AssetAssignableUser[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private adminService: AdminService,
    private authService: AuthService,
    private breadcrumbService: BreadcrumbService,
    private toastService: ToastService
  ) {
    this.role = this.authService.getRole();
  }

  get esAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }

  /** Tecnología y Desarrollo gestionan todos los activos: el área se elige libremente. */
  readonly areaBloqueada = false;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id');
    this.editando = !!this.id;

    this.adminService.catalog().subscribe({
      next: (c) => {
        this.areaOptions = (c?.areas || []).filter((a) => a.status !== false).map((a) => ({ value: a.id, label: a.name, icon: a.icon, color: a.color }));
        this.sucursalOptions = (c?.sucursales || []).map((s) => ({
          value: s.id, label: `${s.code} - ${s.name}`, icon: s.icon, color: s.color
        }));
      },
      error: () => undefined
    });

    this.assetService.tipos().subscribe({
      next: (t) => {
        this.tipos = (t || []).filter((x) => x.activo || x.id === this.request.assetTypeId);
        this.typeOptions = this.tipos.map((x) => ({
          value: x.id, label: x.nombre, detail: x.prefijo, icon: x.icono || 'fa-solid fa-box', color: x.color || undefined,
        }));
        this.actualizarEjemplo();
      },
      error: () => undefined
    });
    this.assetService.config().subscribe({
      next: (c) => {
        this.formatoCodigo = c.formatoCodigo;
        this.actualizarEjemplo();
      },
      error: () => undefined
    });

    this.assetService.asignables().subscribe({
      next: (u) => {
        this.personas = u;
        this.userOptions = u
          .map((p) => ({
            value: p.idUser,
            label: p.displayName || p.corporateEmailUser,
            detail: p.area || p.corporateEmailUser,
            avatar: urlFotoUsuario(p.photoUrl),
            initials: inicialesDe(p.displayName || p.corporateEmailUser),
            sessionState: p.sessionState
          }))
          .sort((a, b) => compararPorNombre(a.label, b.label));
      },
      error: () => undefined
    });

    if (this.id) {
      this.loading = true;
      this.assetService.getById(this.id).subscribe({
        next: (a) => {
          this.request = {
            codeAsset: a.codeAsset,
            nameAsset: a.nameAsset,
            typeAsset: a.typeAsset,
            assetTypeId: a.assetTypeId ?? null,
            // Asignado y en bodega se muestran como "Operativo".
            statusAsset: a.statusAsset === 'ASIGNADO' || a.statusAsset === 'DISPONIBLE' ? 'EN_BODEGA' : a.statusAsset,
            estadoFisicoAsset: a.estadoFisicoAsset || 'BUENO',
            descriptionAsset: a.descriptionAsset || '',
            ubicacionAsset: a.ubicacionAsset || '',
            accesoriosAsset: a.accesoriosAsset || '',
            configuracionAsset: a.configuracionAsset || '',
            novedadesAsset: a.novedadesAsset || '',
            brandAsset: a.brandAsset || '',
            modelAsset: a.modelAsset || '',
            serialNumberAsset: a.serialNumberAsset || '',
            providerAsset: a.providerAsset || '',
            costAsset: a.costAsset ?? undefined,
            notesAsset: a.notesAsset || '',
            purchaseDateAsset: this.aInputDate(a.purchaseDateAsset),
            warrantyUntilAsset: this.aInputDate(a.warrantyUntilAsset),
            areaId: a.areaId || undefined,
            sucursalId: a.sucursalId || undefined,
            assignedUserId: a.assignedUserId || undefined
          };
          this.breadcrumbService.fijar(`/activos/${a.idAsset}`, {
            label: a.nameAsset,
            icon: iconoTipoActivo(a.typeAsset)
          });
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.toastService.error('No se pudo cargar el activo');
          this.router.navigate(['/activos']);
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.id) this.breadcrumbService.quitar(`/activos/${this.id}`);
  }

  /** Convierte una fecha ISO a `yyyy-MM-dd` para el input date. */
  private aInputDate(iso?: string | null): string {
    return iso ? iso.substring(0, 10) : '';
  }

  /** Convierte `yyyy-MM-dd` a un OffsetDateTime ISO (`...T00:00:00-05:00`). */
  private aOffset(fecha?: string): string | undefined {
    if (!fecha) return undefined;
    return fecha.length > 10 ? fecha : `${fecha}T00:00:00-05:00`;
  }

  private formatoCodigo = '';

  /** "TI-LAP-000124" con el prefijo del tipo elegido (solo orientativo). */
  actualizarEjemplo(): void {
    const t = this.tipos.find((x) => x.id === this.request.assetTypeId);
    this.ejemploCodigo = this.formatoCodigo
      ? this.formatoCodigo.replace('{TIPO}', t?.prefijo || 'TIPO').replace('{ANIO}', String(new Date().getFullYear()))
        .replace(/\{NUM(?::(\d+))?\}/, (_m, n) => '0'.repeat(Math.max(0, Number(n || 1) - 1)) + 'N')
      : '';
  }

  get tipoElegido(): AssetTipo | undefined {
    return this.tipos.find((x) => x.id === this.request.assetTypeId);
  }

  typeIcon(type?: string | null): string {
    return iconoTipoActivo(type);
  }

  typeLabel(type?: string | null): string {
    return etiquetaTipoActivo(type);
  }

  /** Persona elegida, para el resumen lateral. */
  get personaElegida(): AssetAssignableUser | undefined {
    return this.personas.find((p) => p.idUser === this.request.assignedUserId);
  }

  /** Estado con el que quedará el activo al guardar. */
  get estadoResultante(): string {
    const pedido = this.request.statusAsset || 'EN_BODEGA';
    if (pedido === 'EN_REPARACION' || pedido === 'BAJA') return pedido;
    return this.request.assignedUserId ? 'ASIGNADO' : 'EN_BODEGA';
  }

  estado(status: string) {
    return metaEstadoActivo(status);
  }

  get valido(): boolean {
    // El código puede ir vacío: el sistema pone el siguiente de la numeración.
    return !!this.request.nameAsset?.trim() && !!this.request.assetTypeId;
  }

  guardar(): void {
    if (!this.valido) {
      this.toastService.warn('El nombre y el tipo del activo son obligatorios');
      return;
    }
    if (this.request.statusAsset === 'BAJA' && this.request.assignedUserId) {
      this.toastService.warn('Un activo dado de baja no puede quedar asignado: quita la persona o cambia el estado');
      return;
    }

    this.guardando = true;
    const payload: AssetRequest = {
      ...this.request,
      codeAsset: this.request.codeAsset?.trim() || undefined,
      typeAsset: undefined,
      purchaseDateAsset: this.aOffset(this.request.purchaseDateAsset),
      warrantyUntilAsset: this.aOffset(this.request.warrantyUntilAsset)
    };

    const obs = this.id ? this.assetService.update(this.id, payload) : this.assetService.create(payload);
    obs.subscribe({
      next: (a) => {
        this.guardando = false;
        this.toastService.success(this.editando ? 'Activo actualizado' : 'Activo registrado');
        this.router.navigate(['/activos', a.idAsset]);
      },
      error: (err) => {
        this.guardando = false;
        this.toastService.error(err?.error?.message || 'No se pudo guardar el activo');
      }
    });
  }

  cancelar(): void {
    this.router.navigate(this.id ? ['/activos', this.id] : ['/activos']);
  }
}

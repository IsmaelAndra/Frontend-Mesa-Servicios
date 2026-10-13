import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { ToastService } from '../../../core/services/toast.service';
import { Asset, AssetAssignableUser, AssetHistory } from '../../../models/asset.model';
import { etiquetaTipoActivo, iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { metaAccionActivo, metaEstadoActivo } from '../../../core/utils/asset-status.util';
import { inicialesDe, urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { compararPorNombre } from '../../../core/utils/user-list.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/** Acciones de la ficha que piden confirmación. */
type Accion = 'asignar' | 'devolver' | 'reparar' | 'finReparacion' | 'baja' | 'reactivar' | 'eliminar';

interface InfoAccion {
  titulo: string;
  texto: string;
  boton: string;
  icono: string;
  clase: string;
  /** Si la acción admite nota (queda en el historial). */
  conNota: boolean;
}

@Component({
  selector: 'app-asset-detail',
  templateUrl: './asset-detail.component.html',
  styleUrls: ['./asset-detail.component.css']
})
export class AssetDetailComponent implements OnInit, OnDestroy {
  id = '';
  asset: Asset | null = null;
  history: AssetHistory[] = [];
  loading = true;
  role = '';

  saving = false;
  /** Acción abierta en el diálogo de confirmación (null = cerrado). */
  accion: Accion | null = null;
  personaElegida: string | null = null;
  nota = '';

  /** Personas asignables (todas o las del área), con foto y punto de sesión. */
  private personas: AssetAssignableUser[] = [];
  userOptions: MasterOption[] = [];

  private fotosRotas = new Set<string>();

  readonly acciones: Record<Accion, InfoAccion> = {
    asignar: { titulo: 'Asignar activo', texto: '', boton: 'Asignar', icono: 'fa-solid fa-user-plus', clase: 'btn-primary', conNota: true },
    devolver: {
      titulo: 'Devolver activo', texto: 'El activo dejará de estar a nombre de esta persona y quedará disponible.',
      boton: 'Registrar devolución', icono: 'fa-solid fa-rotate-left', clase: 'btn-primary', conNota: true
    },
    reparar: {
      titulo: 'Enviar a reparación', texto: 'Mientras esté en reparación no se podrá asignar. Si tiene responsable, lo conserva.',
      boton: 'Enviar a reparación', icono: 'fa-solid fa-screwdriver-wrench', clase: 'btn-warning', conNota: false
    },
    finReparacion: {
      titulo: 'Finalizar reparación', texto: 'El activo vuelve a estar operativo (con su responsable, si lo tenía).',
      boton: 'Finalizar reparación', icono: 'fa-solid fa-wrench', clase: 'btn-success', conNota: false
    },
    baja: {
      titulo: 'Dar de baja', texto: 'Si está asignado, primero se registra la devolución. Después no se podrá asignar.',
      boton: 'Dar de baja', icono: 'fa-solid fa-ban', clase: 'btn-error', conNota: false
    },
    reactivar: {
      titulo: 'Reactivar activo', texto: 'El activo vuelve a estar disponible para asignarse.',
      boton: 'Reactivar', icono: 'fa-solid fa-arrow-rotate-right', clase: 'btn-success', conNota: false
    },
    eliminar: {
      titulo: 'Eliminar activo', texto: 'Se oculta del inventario (baja lógica). El historial se conserva.',
      boton: 'Eliminar', icono: 'fa-solid fa-trash', clase: 'btn-error', conNota: false
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private assetService: AssetService,
    private authService: AuthService,
    private breadcrumbService: BreadcrumbService,
    private toastService: ToastService
  ) {
    this.role = this.authService.getRole();
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
    if (this.puedeGestionar) {
      this.assetService.asignables().subscribe({
        next: (u) => {
          this.personas = u;
          this.construirOpciones();
        },
        error: () => undefined
      });
    }
  }

  ngOnDestroy(): void {
    this.breadcrumbService.quitar(`/activos/${this.id}`);
  }

  get esAdmin(): boolean {
    return this.role === 'SUPER_ADMIN' || this.role === 'ADMIN';
  }

  /** ADMIN y SUPER_ADMIN siempre; el jefe de área solo ve aquí activos de su área. */
  get puedeGestionar(): boolean {
    return this.esAdmin || this.role === 'AREA_MANAGER';
  }

  get puedeEliminar(): boolean {
    return this.esAdmin;
  }

  get estadoActual(): string {
    return this.asset?.statusAsset || '';
  }

  /** Con el activo en reparación o de baja no se asigna (lo rechaza el backend). */
  get asignable(): boolean {
    return this.estadoActual === 'DISPONIBLE' || this.estadoActual === 'ASIGNADO';
  }

  load(): void {
    this.loading = true;
    this.assetService.getById(this.id).subscribe({
      next: (a) => {
        this.asset = a;
        this.loading = false;
        this.construirOpciones();
        this.breadcrumbService.fijar(`/activos/${a.idAsset}`, {
          label: a.nameAsset,
          icon: iconoTipoActivo(a.typeAsset)
        });
      },
      error: () => {
        this.loading = false;
        this.toastService.error('No se pudo cargar el activo');
        this.router.navigate(['/activos']);
      }
    });
    this.cargarHistorial();
  }

  private cargarHistorial(): void {
    this.assetService.getHistory(this.id).subscribe({
      next: (h) => (this.history = h),
      error: () => (this.history = [])
    });
  }

  /** Opciones del desplegable, sin la persona que ya lo tiene. Se calculan una vez. */
  private construirOpciones(): void {
    const actual = this.asset?.assignedUserId;
    this.userOptions = this.personas
      .filter((p) => p.idUser !== actual)
      .map((p) => ({
        value: p.idUser,
        label: p.displayName || p.corporateEmailUser,
        detail: p.area || p.corporateEmailUser,
        avatar: urlFotoUsuario(p.photoUrl),
        initials: inicialesDe(p.displayName || p.corporateEmailUser),
        sessionState: p.sessionState
      }))
      .sort((a, b) => compararPorNombre(a.label, b.label));
  }

  // ------------------------------------------------------------------ acciones

  abrir(accion: Accion): void {
    this.accion = accion;
    this.nota = '';
    this.personaElegida = null;
  }

  cerrar(): void {
    if (!this.saving) this.accion = null;
  }

  get info(): InfoAccion | null {
    return this.accion ? this.acciones[this.accion] : null;
  }

  get tituloAccion(): string {
    if (this.accion === 'asignar' && this.asset?.assignedUser) return 'Reasignar activo';
    return this.info?.titulo || '';
  }

  confirmar(): void {
    if (!this.accion || this.saving) return;
    if (this.accion === 'asignar' && !this.personaElegida) {
      this.toastService.warn('Elige a la persona');
      return;
    }
    const nota = this.nota.trim() || undefined;
    let peticion: Observable<unknown>;
    let ok: string;
    switch (this.accion) {
      case 'asignar':
        peticion = this.assetService.assign(this.id, this.personaElegida!, nota);
        ok = this.asset?.assignedUser ? 'Activo reasignado' : 'Activo asignado';
        break;
      case 'devolver':
        peticion = this.assetService.unassign(this.id, nota);
        ok = 'Devolución registrada';
        break;
      case 'reparar':
        peticion = this.assetService.changeStatus(this.id, 'EN_REPARACION');
        ok = 'Activo enviado a reparación';
        break;
      case 'finReparacion':
        peticion = this.assetService.changeStatus(this.id, 'DISPONIBLE');
        ok = 'Reparación finalizada';
        break;
      case 'baja':
        peticion = this.assetService.changeStatus(this.id, 'BAJA');
        ok = 'Activo dado de baja';
        break;
      case 'reactivar':
        peticion = this.assetService.changeStatus(this.id, 'DISPONIBLE');
        ok = 'Activo reactivado';
        break;
      case 'eliminar':
        peticion = this.assetService.delete(this.id);
        ok = 'Activo eliminado';
        break;
    }
    const eliminar = this.accion === 'eliminar';
    this.saving = true;
    peticion.subscribe({
      next: () => {
        this.saving = false;
        this.accion = null;
        this.toastService.success(ok);
        if (eliminar) {
          this.router.navigate(['/activos']);
        } else {
          this.load();
        }
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message || 'No se pudo completar la acción');
      }
    });
  }

  // ---------------------------------------------------------------- presentación

  estado(s?: string | null) {
    return metaEstadoActivo(s);
  }

  accionMeta(a?: string | null) {
    return metaAccionActivo(a);
  }

  typeIcon(type?: string | null): string {
    return iconoTipoActivo(type);
  }

  typeLabel(type?: string | null): string {
    return etiquetaTipoActivo(type);
  }

  /** Persona asignada en la lista de asignables (para su punto de sesión). */
  get responsable(): AssetAssignableUser | undefined {
    return this.personas.find((p) => p.idUser === this.asset?.assignedUserId);
  }

  foto(url?: string | null): string | null {
    const abs = urlFotoUsuario(url);
    return abs && !this.fotosRotas.has(abs) ? abs : null;
  }

  fotoRota(url?: string | null): void {
    const abs = urlFotoUsuario(url);
    if (abs) this.fotosRotas.add(abs);
  }

  iniciales(nombre?: string | null): string {
    return inicialesDe(nombre);
  }

  /** Frase principal de un movimiento: "Reasignado a Ana", "Devuelto por Luis"... */
  frase(h: AssetHistory): string {
    const quien = h.userDisplayName || h.user || '';
    switch (h.actionType) {
      case 'ALTA': return 'Alta del activo';
      case 'ASIGNACION': return `Asignado a ${quien}`;
      case 'REASIGNACION': return `Reasignado a ${quien}`;
      case 'DEVOLUCION': return `Devuelto por ${quien}`;
      case 'REPARACION': return 'Enviado a reparación';
      case 'FIN_REPARACION': return 'Reparación finalizada';
      case 'BAJA': return 'Dado de baja';
      default: return metaAccionActivo(h.actionType).etiqueta;
    }
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-EC', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleString('es-EC', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** La garantía vence en menos de 60 días (o ya venció). */
  get garantiaPorVencer(): boolean {
    const g = this.asset?.warrantyUntilAsset;
    if (!g) return false;
    return new Date(g).getTime() - Date.now() < 60 * 86_400_000;
  }

  trackHistorial(_index: number, h: AssetHistory): string {
    return h.idAssetHistory;
  }
}

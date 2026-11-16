import { confirmar } from '../../../core/utils/confirmar.util';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AssetService } from '../../../core/services/asset.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { ToastService } from '../../../core/services/toast.service';
import { Acta, Asset, AssetArchivo, AssetAssignableUser, AssetHistory, ESTADOS_ACTA, ESTADOS_FISICOS, LIMITES_ARCHIVOS, TIPOS_ACTA, TipoActa } from '../../../models/asset.model';
import { abrirBlob, tamanoLegible } from '../../../core/utils/abrir-blob.util';
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
  // ---- Fase 4: fotos, documentos y actas
  readonly limites = LIMITES_ARCHIVOS;
  readonly tiposActa = TIPOS_ACTA;
  readonly estadosActa = ESTADOS_ACTA;
  archivos: AssetArchivo[] = [];
  /** Fotos con su URL de blob (llegan por la API con sesión, no hay URL pública). */
  fotos: { archivo: AssetArchivo; url: string }[] = [];
  documentos: AssetArchivo[] = [];
  actas: Acta[] = [];
  subiendo = false;
  venceGarantia = '';
  /** Acta que se está generando (null = modal cerrado). */
  actaTipo: TipoActa | null = null;
  fotoAmpliada: string | null = null;

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
      titulo: 'Devolver activo', texto: 'El activo dejará de estar a nombre de esta persona y quedará en bodega.',
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
      titulo: 'Reactivar activo', texto: 'El activo vuelve a bodega, listo para entregarse.',
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
    this.liberarFotos();
  }

  get esAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }

  /** Tecnología, Desarrollo y el súper admin (permiso del servidor). */
  get puedeGestionar(): boolean {
    return this.authService.gestionaActivos();
  }

  get puedeEliminar(): boolean {
    return this.esAdmin;
  }

  get estadoActual(): string {
    return this.asset?.statusAsset || '';
  }

  /** Con el activo en reparación o de baja no se asigna (lo rechaza el backend). */
  get asignable(): boolean {
    return this.estadoActual === 'EN_BODEGA' || this.estadoActual === 'DISPONIBLE' || this.estadoActual === 'ASIGNADO';
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
    this.cargarArchivos();
    this.cargarActas();
    this.assetService.tipos().subscribe({ error: () => undefined });
  }

  // ------------------------------------------------------------- archivos

  private cargarArchivos(): void {
    this.assetService.archivos(this.id).subscribe({
      next: (l) => {
        this.archivos = l || [];
        this.documentos = this.archivos.filter((a) => a.tipo !== 'FOTO');
        this.cargarFotos(this.archivos.filter((a) => a.tipo === 'FOTO'));
      },
      error: () => (this.archivos = []),
    });
  }

  private cargarFotos(lista: AssetArchivo[]): void {
    this.liberarFotos();
    for (const f of lista) {
      this.assetService.descargarArchivo(this.id, f.id).subscribe({
        next: (b) => (this.fotos = [...this.fotos, { archivo: f, url: URL.createObjectURL(b) }]),
        error: () => undefined,
      });
    }
  }

  private liberarFotos(): void {
    this.fotos.forEach((f) => URL.revokeObjectURL(f.url));
    this.fotos = [];
  }

  get quedanFotos(): number {
    return Math.max(0, this.limites.fotos - this.archivos.filter((a) => a.tipo === 'FOTO').length);
  }

  /** Fotos desde la galería o la cámara del teléfono (input con capture). */
  subirFotos(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const lista = Array.from(input.files || []).slice(0, this.quedanFotos);
    input.value = '';
    const grandes = lista.filter((f) => f.size > this.limites.fotoMb * 1024 * 1024);
    if (grandes.length) {
      this.toastService.warn(`Cada foto puede pesar hasta ${this.limites.fotoMb} MB`);
      return;
    }
    this.subirVarios(lista, 'FOTO');
  }

  subirDocumento(ev: Event, tipo: 'GARANTIA' | 'FACTURA' | 'OTRO'): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > this.limites.pdfMb * 1024 * 1024) {
      this.toastService.warn(`El PDF puede pesar hasta ${this.limites.pdfMb} MB`);
      return;
    }
    this.subirVarios([f], tipo, tipo === 'GARANTIA' ? this.venceGarantia || null : null);
  }

  private subirVarios(lista: File[], tipo: string, vence: string | null = null): void {
    if (!lista.length) return;
    this.subiendo = true;
    let pendientes = lista.length;
    for (const f of lista) {
      this.assetService.subirArchivo(this.id, tipo, f, vence).subscribe({
        next: () => {
          if (--pendientes === 0) {
            this.subiendo = false;
            this.toastService.success(lista.length > 1 ? 'Archivos subidos' : 'Archivo subido');
            this.cargarArchivos();
            if (tipo === 'GARANTIA' && vence) this.load();
          }
        },
        error: (e) => {
          this.subiendo = --pendientes > 0;
          this.toastService.error(e?.error?.message || `No se pudo subir ${f.name}`);
          if (!pendientes) this.cargarArchivos();
        },
      });
    }
  }

  abrirArchivo(a: AssetArchivo): void {
    this.assetService.descargarArchivo(this.id, a.id).subscribe({
      next: (b) => abrirBlob(b, a.nombre),
      error: () => this.toastService.error('No se pudo abrir el archivo'),
    });
  }

  async borrarArchivo(a: AssetArchivo): Promise<void> {
    if (!(await confirmar({ titulo: '¿Eliminar el archivo?', texto: a.nombre }))) return;
    this.assetService.eliminarArchivo(this.id, a.id).subscribe({
      next: () => this.cargarArchivos(),
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar'),
    });
  }

  tamano(b: number): string {
    return tamanoLegible(b);
  }

  etiquetaDocumento(t: string): string {
    return t === 'GARANTIA' ? 'Garantía' : t === 'FACTURA' ? 'Factura' : 'Documento';
  }

  // ------------------------------------------------------------- actas

  private cargarActas(): void {
    this.assetService.actas(this.id).subscribe({ next: (l) => (this.actas = l || []), error: () => (this.actas = []) });
  }

  abrirActa(tipo: TipoActa): void {
    this.actaTipo = tipo;
  }

  actaCerrada(a: Acta | null): void {
    this.actaTipo = null;
    if (a) this.load();
  }

  verActa(a: Acta): void {
    this.assetService.actaPdf(a.id).subscribe({
      next: (b) => abrirBlob(b, `${a.numero}.pdf`),
      error: () => this.toastService.error('No se pudo abrir el acta'),
    });
  }

  verFirmada(a: Acta): void {
    this.assetService.actaFirmada(a.id).subscribe({
      next: (b) => abrirBlob(b, `${a.numero}-firmada`),
      error: () => this.toastService.error('No se pudo abrir el acta firmada'),
    });
  }

  subirFirmada(ev: Event, a: Acta): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.assetService.subirActaFirmada(a.id, f).subscribe({
      next: () => {
        this.toastService.success('Acta firmada guardada');
        this.cargarActas();
      },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo subir el acta firmada'),
    });
  }

  imprimirEtiqueta(): void {
    this.assetService.etiquetas([this.id]).subscribe({
      next: (b) => abrirBlob(b, `etiqueta-${this.asset?.codeAsset}.pdf`),
      error: () => this.toastService.error('No se pudo generar la etiqueta'),
    });
  }

  estadoFisico(v?: string | null) {
    return ESTADOS_FISICOS.find((e) => e.valor === v) ?? ESTADOS_FISICOS[1];
  }

  trackActa(_: number, a: Acta): string {
    return a.id;
  }

  trackArchivo(_: number, a: AssetArchivo): string {
    return a.id;
  }

  trackFoto(_: number, f: { archivo: AssetArchivo }): string {
    return f.archivo.id;
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
        peticion = this.assetService.changeStatus(this.id, 'EN_BODEGA');
        ok = 'Reparación finalizada';
        break;
      case 'baja':
        peticion = this.assetService.changeStatus(this.id, 'BAJA');
        ok = 'Activo dado de baja';
        break;
      case 'reactivar':
        peticion = this.assetService.changeStatus(this.id, 'EN_BODEGA');
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
    // "2026-12-01" (fecha sin hora: acta, vencimiento) es un día local. new Date()
    // la toma como medianoche UTC y en Ecuador (UTC-5) salía el día anterior.
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const d = soloFecha ? new Date(+soloFecha[1], +soloFecha[2] - 1, +soloFecha[3]) : new Date(dateStr);
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

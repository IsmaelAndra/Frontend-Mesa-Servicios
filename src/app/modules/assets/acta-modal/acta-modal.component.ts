import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AssetService } from '../../../core/services/asset.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Acta, Asset, TIPOS_ACTA, TipoActa } from '../../../models/asset.model';
import { iconoTipoActivo } from '../../../core/utils/asset-type.util';
import { inicialesDe, urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { compararPorNombre } from '../../../core/utils/user-list.util';
import { abrirBlob } from '../../../core/utils/abrir-blob.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Modal para entregar, devolver o reasignar equipos con su acta
 * FOR-POL-TIC-01-10. Hacer el acta ES el movimiento (lo hace el backend en una
 * sola operación). Varios equipos por acta: el primero es el principal
 * ("Detalle del bien"); el resto sale en "Accesorios entregados".
 */
@Component({
  selector: 'app-acta-modal',
  templateUrl: './acta-modal.component.html',
})
export class ActaModalComponent implements OnInit {
  @Input() tipo: TipoActa = 'ENTREGA';
  /** Equipos con los que se abre (desde la ficha o la selección de la lista). */
  @Input() activos: Asset[] = [];
  /** Se emite al cerrar: el acta creada o null si se canceló. */
  @Output() cerrado = new EventEmitter<Acta | null>();

  readonly tipos = TIPOS_ACTA;
  equipos: Asset[] = [];
  /** Más equipos que se pueden sumar (en bodega para una entrega; del mismo custodio si no). */
  disponibles: MasterOption[] = [];
  private candidatos: Asset[] = [];
  agregar: string | null = null;

  personas: MasterOption[] = [];
  revisores: MasterOption[] = [];
  sucursales: MasterOption[] = [];
  custodioId: string | null = null;
  revisadoPorId: string | null = null;
  sucursalId: string | null = null;
  ciudad = '';
  asunto = '';
  cc = '';
  observaciones = '';

  guardando = false;
  /** Firmantes sin nombre o cargo: se avisa antes de generar (el acta los imprime). */
  faltan: string[] = [];
  /** Último error del servidor, visible dentro del modal (el aviso flotante se va solo). */
  errorActa = '';
  /** Acta ya creada: el modal pasa a "listo, descargue el PDF". */
  creada: Acta | null = null;

  constructor(private assetService: AssetService, private adminService: AdminService, private toast: ToastService) {}

  ngOnInit(): void {
    this.equipos = [...this.activos];
    this.asunto = this.tipos[this.tipo].texto + ' de equipos tecnológicos';
    this.assetService.config().subscribe({ next: (c) => (this.ciudad = c.ciudad), error: () => undefined });
    this.assetService.asignables().subscribe({
      next: (u) => (this.personas = u.map((p) => ({
        value: p.idUser, label: p.displayName || p.corporateEmailUser, detail: p.area || p.corporateEmailUser,
        avatar: urlFotoUsuario(p.photoUrl), initials: inicialesDe(p.displayName || p.corporateEmailUser),
        sessionState: p.sessionState,
      })).sort((a, b) => compararPorNombre(a.label, b.label))),
      error: () => undefined,
    });
    this.assetService.revisores().subscribe({
      next: (r) => (this.revisores = r.map((p) => ({ value: p.id, label: p.nombre, detail: p.cargo || p.correo, icon: 'fa-solid fa-user-check' }))),
      error: () => undefined,
    });
    this.adminService.catalog().subscribe({
      next: (c) => (this.sucursales = (c.sucursales || []).map((s) => ({ value: s.id, label: s.name, icon: s.icon, color: s.color }))),
      error: () => undefined,
    });
    this.cargarCandidatos();
    this.revisarFaltantes();
  }

  /** Pregunta al servidor quién firmaría sin nombre o cargo con lo elegido ahora. */
  revisarFaltantes(): void {
    this.errorActa = '';
    if (!this.equipos.length) {
      this.faltan = [];
      return;
    }
    this.assetService.faltantesActa(this.peticion()).subscribe({
      next: (l) => (this.faltan = l || []),
      error: () => (this.faltan = []),
    });
  }

  /** Correo de cada faltante, para enlazar a Usuarios. */
  correoDe(f: string): string {
    return f.split(' ')[0];
  }

  private peticion() {
    return {
      tipo: this.tipo,
      custodioId: this.tipo === 'DEVOLUCION' ? null : this.custodioId,
      activos: this.equipos.map((e) => e.idAsset),
      revisadoPorId: this.revisadoPorId,
      sucursalId: this.sucursalId,
      ciudad: this.ciudad || null,
      asunto: this.asunto || null,
      cc: this.cc || null,
      observaciones: this.observaciones || null,
    };
  }

  /** Para una entrega, equipos en bodega; para devolver o reasignar, los del mismo custodio. */
  private cargarCandidatos(): void {
    const titular = this.equipos[0]?.assignedUserId;
    const obs = this.tipo === 'ENTREGA' || !titular
      ? this.assetService.search({ status: 'EN_BODEGA', page: 0, size: 200 })
      : null;
    if (obs) {
      obs.subscribe({ next: (p) => this.fijarCandidatos(p.content || []), error: () => undefined });
    } else if (titular) {
      this.assetService.findByUser(titular).subscribe({ next: (l) => this.fijarCandidatos(l || []), error: () => undefined });
    }
  }

  private fijarCandidatos(lista: Asset[]): void {
    this.candidatos = lista;
    this.recalcularDisponibles();
  }

  private recalcularDisponibles(): void {
    const ya = new Set(this.equipos.map((e) => e.idAsset));
    this.disponibles = this.candidatos.filter((a) => !ya.has(a.idAsset)).map((a) => ({
      value: a.idAsset, label: `${a.codeAsset} · ${a.nameAsset}`, detail: a.serialNumberAsset || undefined,
      icon: iconoTipoActivo(a.assetTypeId || a.typeAsset),
    }));
  }

  sumar(): void {
    const a = this.candidatos.find((x) => x.idAsset === this.agregar);
    if (!a) return;
    this.equipos = [...this.equipos, a];
    this.agregar = null;
    this.recalcularDisponibles();
  }

  quitar(i: number): void {
    this.equipos = this.equipos.filter((_, j) => j !== i);
    this.recalcularDisponibles();
  }

  hacerPrincipal(i: number): void {
    const e = [...this.equipos];
    const [x] = e.splice(i, 1);
    this.equipos = [x, ...e];
  }

  icono(a: Asset): string {
    return iconoTipoActivo(a.assetTypeId || a.typeAsset);
  }

  /** Custodio actual (devolución y reasignación): el de los equipos elegidos. */
  get titular(): string | null {
    return this.equipos[0]?.assignedUserDisplayName || this.equipos[0]?.assignedUser || null;
  }

  get valido(): boolean {
    if (!this.equipos.length || this.guardando || this.faltan.length) return false;
    if (this.tipo !== 'DEVOLUCION' && !this.custodioId) return false;
    return true;
  }

  crear(): void {
    if (!this.valido) return;
    this.guardando = true;
    this.errorActa = '';
    this.assetService.crearActa(this.peticion()).subscribe({
      next: (a) => {
        this.guardando = false;
        this.creada = a;
        this.toast.success(`Acta ${a.numero} generada`);
      },
      error: (e) => {
        this.guardando = false;
        this.errorActa = e?.error?.message || 'No se pudo generar el acta';
        this.toast.error(this.errorActa);
        this.revisarFaltantes();
      },
    });
  }

  verPdf(): void {
    if (!this.creada) return;
    this.assetService.actaPdf(this.creada.id).subscribe({
      next: (b) => abrirBlob(b, `${this.creada!.numero}.pdf`),
      error: () => this.toast.error('No se pudo abrir el PDF'),
    });
  }

  cerrar(): void {
    if (this.guardando) return;
    this.cerrado.emit(this.creada);
  }

  trackEquipo(_: number, a: Asset): string {
    return a.idAsset;
  }
}

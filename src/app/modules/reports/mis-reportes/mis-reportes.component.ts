import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  DefinicionReporte, ReporteUsuario, ReporteUsuarioService, TablaReporte, VistaPreviaReporte,
} from '../../../core/services/reporte-usuario.service';
import { Catalog } from '../../../models/user.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { ORDEN_REPORTES, PERIODOS_REPORTE } from '../../../core/utils/opciones-select.util';

/**
 * "Mis reportes": reportes armados en un modal eligiendo tabla, columnas y
 * filtros (Fase 2). Los crean el súper admin y los jefes; el auditor los ve y
 * exporta. El jefe solo obtiene filas de sus áreas (lo aplica el backend).
 */
@Component({
  selector: 'app-mis-reportes',
  templateUrl: './mis-reportes.component.html',
})
export class MisReportesComponent implements OnInit {
  tablas: TablaReporte[] = [];
  reportes: ReporteUsuario[] = [];
  cargando = false;
  puedeCrear = false;
  esSuperAdmin = false;

  /** Periodo con el que se ven y exportan los reportes guardados. */
  desde = this.inicioDeMes();
  hasta = this.hoy();

  // ---- Filtros de la lista
  busqueda = '';
  periodo = 'MES';
  filtroTabla: string | null = null;
  filtroOrigen: string | null = null;
  orden = 'label';
  readonly periodos = PERIODOS_REPORTE;
  readonly ordenes = ORDEN_REPORTES;
  readonly origenes: MasterOption[] = [
    { value: 'SISTEMA', label: 'Del sistema', icon: 'fa-solid fa-shield-halved', color: '#062E86' },
    { value: 'PROPIOS', label: 'Míos', icon: 'fa-solid fa-user', color: '#16A34A' },
    { value: 'OTROS', label: 'De otras personas', icon: 'fa-solid fa-users', color: '#7C3AED' },
  ];
  /** Tablas como opciones del filtro (se arman al cargar el catálogo, no en un getter). */
  opcionesTabla: MasterOption[] = [];
  /** Lista ya filtrada y ordenada; se recalcula al cambiar un filtro. */
  visibles: ReporteUsuario[] = [];

  // ---- Pasos del modal
  readonly pasos = [
    { titulo: 'Datos', icono: 'fa-solid fa-database' },
    { titulo: 'Forma', icono: 'fa-solid fa-shapes' },
    { titulo: 'Columnas', icono: 'fa-solid fa-table-columns' },
    { titulo: 'Filtros', icono: 'fa-solid fa-filter' },
    { titulo: 'Tarjeta', icono: 'fa-solid fa-palette' },
    { titulo: 'Vista previa', icono: 'fa-solid fa-eye' },
  ];
  paso = 0;

  // ---- Modal del constructor
  editando = false;
  editId: string | null = null;
  nombre = '';
  descripcion = '';
  def: DefinicionReporte = { tabla: '', columnas: [], filtros: {}, medidas: [] };
  /** Icono y color de la tarjeta del reporte. */
  icono = 'fa-solid fa-chart-column';
  color = '#062E86';
  readonly iconosSugeridos = [
    'fa-solid fa-chart-column', 'fa-solid fa-chart-pie', 'fa-solid fa-table', 'fa-solid fa-ticket',
    'fa-solid fa-stopwatch', 'fa-solid fa-star', 'fa-solid fa-users', 'fa-solid fa-building',
    'fa-solid fa-store', 'fa-solid fa-headset',
  ];
  readonly coloresSugeridos = ['#062E86', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#475569'];
  /** Máximo de niveles al agrupar (igual que el backend). */
  readonly maxGrupos = 3;
  /** Opciones de cada filtro de la tabla elegida; se calculan al elegirla, no en un getter. */
  opcionesFiltro: Record<string, MasterOption[]> = {};
  guardando = false;

  // ---- Vista previa (en el modal o de un guardado)
  vista: VistaPreviaReporte | null = null;
  vistaDe: ReporteUsuario | null = null;
  cargandoVista = false;
  errorVista = '';
  exportando: Record<string, boolean> = {};

  private catalogo: Catalog | null = null;

  constructor(
    private servicio: ReporteUsuarioService,
    private adminService: AdminService,
    private authService: AuthService,
    private toast: ToastService,
  ) {
    const rol = this.authService.getRole();
    this.esSuperAdmin = rol === 'SUPER_ADMIN';
    this.puedeCrear = rol === 'SUPER_ADMIN' || rol === 'AREA_MANAGER';
  }

  ngOnInit(): void {
    this.servicio.catalogo().subscribe({
      next: (t) => {
        this.tablas = t || [];
        this.opcionesTabla = this.tablas.map((x) => ({ value: x.clave, label: x.nombre, icon: x.icono, color: '#062E86' }));
      },
      error: () => undefined,
    });
    this.adminService.catalog().subscribe({ next: (c) => (this.catalogo = c), error: () => undefined });
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.listar().subscribe({
      next: (l) => {
        this.reportes = l || [];
        this.cargando = false;
        this.filtrar();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar sus reportes');
      },
    });
  }

  tablaDe(clave: string): TablaReporte | undefined {
    return this.tablas.find((t) => t.clave === clave);
  }

  get tablaElegida(): TablaReporte | undefined {
    return this.tablaDe(this.def.tabla);
  }

  etiquetaColumna(clave: string): string {
    return this.tablaElegida?.columnas.find((c) => c.clave === clave)?.etiqueta ?? clave;
  }

  /** Resumen = con totales por grupo; Detalle = una fila por registro. */
  get esResumen(): boolean {
    return !!this.def.medidas?.length;
  }

  /** En un resumen solo se ofrecen las columnas por las que se puede agrupar. */
  columnasDisponibles(t: TablaReporte): TablaReporte['columnas'] {
    return this.esResumen ? t.columnas.filter((c) => c.agrupable) : t.columnas;
  }

  cambiarModo(resumen: boolean): void {
    if (resumen === this.esResumen) return;
    const t = this.tablaElegida;
    if (resumen && t) {
      const agrupables = new Set(t.columnas.filter((c) => c.agrupable).map((c) => c.clave));
      const grupos = this.def.columnas.filter((c) => agrupables.has(c)).slice(0, this.maxGrupos);
      this.def = { ...this.def, columnas: grupos.length ? grupos : [...agrupables].slice(0, 1),
        medidas: [t.medidas[0]?.clave].filter(Boolean) as string[] };
    } else {
      this.def = { ...this.def, medidas: [] };
    }
    this.vista = null;
  }

  alternarMedida(clave: string): void {
    const m = this.def.medidas || [];
    const nuevas = m.includes(clave) ? m.filter((x) => x !== clave) : [...m, clave];
    // Un resumen necesita al menos un total.
    if (!nuevas.length) return;
    this.def = { ...this.def, medidas: nuevas };
    this.vista = null;
  }

  etiquetaMedida(clave: string): string {
    return this.tablaElegida?.medidas.find((m) => m.clave === clave)?.etiqueta ?? clave;
  }

  /** Icono y color de la tarjeta (los de la tabla si el reporte no tiene propios). */
  iconoDe(r: ReporteUsuario): string {
    return r.icono || this.tablaDe(r.definicion.tabla)?.icono || 'fa-solid fa-table';
  }

  colorDe(r: ReporteUsuario): string {
    return r.color || '#062E86';
  }

  // ------------------------------------------------------------------ filtros de la lista

  filtrar(): void {
    const q = this.busqueda.trim().toLowerCase();
    const l = this.reportes.filter((r) =>
      (!q || r.nombre.toLowerCase().includes(q) || (r.descripcion || '').toLowerCase().includes(q))
      && (!this.filtroTabla || r.definicion.tabla === this.filtroTabla)
      && (!this.filtroOrigen
        || (this.filtroOrigen === 'SISTEMA' && r.sistema)
        || (this.filtroOrigen === 'PROPIOS' && r.propio && !r.sistema)
        || (this.filtroOrigen === 'OTROS' && !r.propio && !r.sistema)));
    const dir = this.orden === 'label-desc' ? -1 : 1;
    this.visibles = l.sort((a, b) => dir * a.nombre.localeCompare(b.nombre, 'es'));
  }

  get hayFiltros(): boolean {
    return !!this.busqueda.trim() || !!this.filtroTabla || !!this.filtroOrigen;
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroTabla = null;
    this.filtroOrigen = null;
    this.filtrar();
  }

  /** El periodo rápido fija las fechas; "Personalizado" deja escribirlas. */
  cambiarPeriodo(p: string): void {
    this.periodo = p;
    const hoy = new Date();
    const iso = (d: Date) => this.isoLocal(d);
    switch (p) {
      case 'HOY': this.desde = iso(hoy); this.hasta = iso(hoy); break;
      case 'MES': this.desde = this.inicioDeMes(); this.hasta = iso(hoy); break;
      case 'ANIO': this.desde = iso(new Date(hoy.getFullYear(), 0, 1)); this.hasta = iso(hoy); break;
      case 'SEMESTRE': this.desde = iso(new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)); this.hasta = iso(hoy); break;
      case 'TODO': this.desde = '2000-01-01'; this.hasta = iso(hoy); break;
      default: break;
    }
  }

  get etiquetaPeriodo(): string {
    return this.periodos.find((p) => p.value === this.periodo)?.label ?? '';
  }

  // ------------------------------------------------------------------ pasos del modal

  /** Si se puede pasar del paso indicado al siguiente. */
  pasoValido(i: number): boolean {
    switch (i) {
      case 0: return !!this.def.tabla;
      case 1: return !this.esResumen || !!this.def.medidas?.length;
      case 2: return this.def.columnas.length > 0;
      case 4: return !!this.nombre.trim();
      default: return true;
    }
  }

  /**
   * Con la tabla elegida se puede saltar a cualquier paso (antes había que
   * pasar por todos). Lo que falte se avisa al guardar y en el propio paso.
   */
  pasoAlcanzable(i: number): boolean {
    return i === 0 || this.pasoValido(0);
  }

  irAPaso(i: number): void {
    if (i < 0 || i >= this.pasos.length || !this.pasoAlcanzable(i)) return;
    this.paso = i;
    // El último paso muestra la vista previa sin tener que pedirla.
    if (i === this.pasos.length - 1 && !this.vista && !this.cargandoVista) this.previsualizar();
  }

  siguiente(): void {
    if (this.pasoValido(this.paso)) this.irAPaso(this.paso + 1);
  }

  anterior(): void {
    this.irAPaso(this.paso - 1);
  }

  get esUltimoPaso(): boolean {
    return this.paso === this.pasos.length - 1;
  }

  // ------------------------------------------------------------------ constructor

  nuevo(): void {
    this.editId = null;
    this.nombre = '';
    this.descripcion = '';
    this.def = { tabla: '', columnas: [], filtros: {}, medidas: [] };
    this.icono = 'fa-solid fa-chart-column';
    this.color = '#062E86';
    this.vista = null;
    this.paso = 0;
    this.editando = true;
  }

  editar(r: ReporteUsuario): void {
    this.editId = r.id;
    this.nombre = r.nombre;
    this.descripcion = r.descripcion ?? '';
    this.def = { tabla: r.definicion.tabla, columnas: [...r.definicion.columnas],
      filtros: { ...(r.definicion.filtros || {}) }, medidas: [...(r.definicion.medidas || [])] };
    this.icono = r.icono || 'fa-solid fa-chart-column';
    this.color = r.color || '#062E86';
    this.prepararFiltros();
    this.vista = null;
    this.paso = 0;
    this.editando = true;
  }

  elegirTabla(t: TablaReporte): void {
    if (this.def.tabla === t.clave) return;
    // Por defecto, las primeras columnas: así la vista previa ya dice algo.
    this.def = { tabla: t.clave, columnas: t.columnas.slice(0, 6).map((c) => c.clave), filtros: {}, medidas: [] };
    this.icono = t.icono || this.icono;
    this.prepararFiltros();
    this.vista = null;
  }

  alternarColumna(clave: string): void {
    const c = this.def.columnas;
    if (!c.includes(clave) && this.esResumen && c.length >= this.maxGrupos) {
      this.toast.error(`Se puede agrupar por ${this.maxGrupos} columnas como máximo`);
      return;
    }
    this.def.columnas = c.includes(clave) ? c.filter((x) => x !== clave) : [...c, clave];
    this.vista = null;
  }

  moverColumna(i: number, paso: -1 | 1): void {
    const c = [...this.def.columnas];
    const j = i + paso;
    if (j < 0 || j >= c.length) return;
    [c[i], c[j]] = [c[j], c[i]];
    this.def.columnas = c;
    this.vista = null;
  }

  cambiarFiltro(clave: string, valor: string | null): void {
    const f = { ...this.def.filtros };
    if (valor) f[clave] = valor;
    else delete f[clave];
    this.def.filtros = f;
    this.vista = null;
  }

  private prepararFiltros(): void {
    const c = this.catalogo;
    const mias = this.esSuperAdmin ? null : this.authService.areasACargo();
    const op = (l: { id: string; name: string; icon?: string; color?: string }[] | undefined): MasterOption[] =>
      (l || []).map((x) => ({ value: x.id, label: x.name, icon: x.icon, color: x.color }));
    const opciones: Record<string, MasterOption[]> = {};
    for (const f of this.tablaElegida?.filtros || []) {
      switch (f.tipo) {
        case 'AREA':
          // El jefe solo puede filtrar por sus áreas (el backend lo acota igual).
          opciones[f.clave] = op((c?.areas || []).filter((a) => a.status !== false && (!mias || mias.includes(a.id))));
          break;
        case 'ESTADO': opciones[f.clave] = op(c?.statuses); break;
        case 'PRIORIDAD': opciones[f.clave] = op(c?.priorities); break;
        case 'CATEGORIA': opciones[f.clave] = op(c?.categories); break;
        case 'SUCURSAL': opciones[f.clave] = op(c?.sucursales); break;
        case 'TIPO': opciones[f.clave] = op(c?.ticketTypes); break;
        default: opciones[f.clave] = [];
      }
    }
    this.opcionesFiltro = opciones;
  }

  get puedeGuardar(): boolean {
    return !!this.nombre.trim() && !!this.def.tabla && this.def.columnas.length > 0 && !this.guardando
      && (!this.esResumen || !!this.def.medidas?.length);
  }

  previsualizar(): void {
    if (!this.def.tabla || !this.def.columnas.length) return;
    this.cargandoVista = true;
    this.errorVista = '';
    this.servicio.vistaPrevia(this.def, this.desde, this.hasta).subscribe({
      next: (v) => {
        this.vista = v;
        this.cargandoVista = false;
      },
      error: (err) => {
        this.cargandoVista = false;
        this.errorVista = err?.error?.message || 'No se pudo generar la vista previa';
        this.toast.error(this.errorVista);
      },
    });
  }

  guardar(): void {
    if (!this.puedeGuardar) return;
    this.guardando = true;
    this.servicio.guardar(this.editId, this.nombre.trim(), this.descripcion.trim(), this.def, this.icono, this.color).subscribe({
      next: () => {
        this.guardando = false;
        this.editando = false;
        this.toast.success(this.editId ? 'Reporte actualizado' : 'Reporte guardado');
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo guardar el reporte');
      },
    });
  }

  cerrarEditor(): void {
    if (!this.guardando) this.editando = false;
  }

  // ------------------------------------------------------------------ guardados

  ver(r: ReporteUsuario): void {
    this.vistaDe = r;
    this.vista = null;
    this.cargandoVista = true;
    this.servicio.vistaPreviaGuardado(r.id, this.desde, this.hasta).subscribe({
      next: (v) => {
        this.vista = v;
        this.cargandoVista = false;
      },
      error: (err) => {
        this.cargandoVista = false;
        this.toast.error(err?.error?.message || 'No se pudo abrir el reporte');
      },
    });
  }

  cerrarVista(): void {
    this.vistaDe = null;
    this.vista = null;
  }

  exportar(r: ReporteUsuario, formato: 'PDF' | 'EXCEL'): void {
    const k = r.id + formato;
    if (this.exportando[k]) return;
    this.exportando[k] = true;
    this.servicio.exportar(r.id, formato, this.desde, this.hasta).subscribe({
      next: (blob) => {
        this.exportando[k] = false;
        const limpio = r.nombre.normalize('NFD').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'reporte';
        saveAs(blob, `${limpio}_${this.hasta}.${formato === 'EXCEL' ? 'xlsx' : 'pdf'}`);
        this.toast.success(`${formato === 'EXCEL' ? 'Excel' : 'PDF'} descargado`);
      },
      error: () => {
        this.exportando[k] = false;
        this.toast.error('No se pudo exportar el reporte');
      },
    });
  }

  eliminar(r: ReporteUsuario): void {
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280', focusCancel: true, title: '¿Eliminar el reporte?', text: r.nombre, icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' })
      .then((res) => {
        if (!res.isConfirmed) return;
        this.servicio.eliminar(r.id).subscribe({
          next: () => {
            this.toast.success('Reporte eliminado');
            this.cargar();
          },
          error: (err) => this.toast.error(err?.error?.message || 'No se pudo eliminar'),
        });
      });
  }

  puedeEditar(r: ReporteUsuario): boolean {
    return r.propio || this.esSuperAdmin;
  }

  trackReporte(_: number, r: ReporteUsuario): string {
    return r.id;
  }

  /** Fecha local en yyyy-MM-dd (toISOString usa UTC y, de noche, daba el día siguiente). */
  private isoLocal(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private hoy(): string {
    return this.isoLocal(new Date());
  }

  private inicioDeMes(): string {
    const d = new Date();
    return this.isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}

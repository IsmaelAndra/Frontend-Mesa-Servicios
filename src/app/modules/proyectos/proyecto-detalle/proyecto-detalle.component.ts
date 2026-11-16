import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import { confirmar } from '../../../core/utils/confirmar.util';
import { Observable, Subscription } from 'rxjs';
import { SseService } from '../../../core/services/sse.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { AdminService } from '../../../core/services/admin.service';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  COLUMNAS_PROYECTO, ESTADOS_PROYECTO, ESTADOS_SPRINT, EstadoItem, EstadoProyecto, ItemRequest, ProyectoDetalle,
  ProyectoItem, ProyectoMiembro, ProyectoObjetivo, ProyectoSprint, SprintRequest,
} from '../../../models/proyecto.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

type Pestana = 'tablero' | 'sprints' | 'objetivos' | 'equipo' | 'chat';

/** Un proyecto: tablero tipo GitHub Projects, sprints, objetivos/logros y equipo. */
@Component({
  selector: 'app-proyecto-detalle',
  templateUrl: './proyecto-detalle.component.html',
})
export class ProyectoDetalleComponent implements OnInit, OnDestroy {
  id = '';
  d: ProyectoDetalle | null = null;
  cargando = true;
  pestana: Pestana = 'tablero';
  readonly columnas = COLUMNAS_PROYECTO;
  /** Ids de las listas del tablero, para conectarlas entre sí. */
  readonly idsColumnas = COLUMNAS_PROYECTO.map((c) => 'col-' + c.clave);
  /** Columnas para mover una tarjeta sin arrastrar (también en el móvil). */
  readonly opcionesColumna: MasterOption[] = COLUMNAS_PROYECTO
    .map((c) => ({ value: c.clave, label: c.titulo, icon: c.icono, color: c.color }));
  readonly estadosProyecto = ESTADOS_PROYECTO;
  readonly estadosSprint = ESTADOS_SPRINT;

  /** Tarjetas por columna (se recalcula al cargar o filtrar, no en un getter). */
  tablero: Record<EstadoItem, ProyectoItem[]> = { POR_HACER: [], EN_CURSO: [], EN_REVISION: [], HECHO: [] };
  /** '' = todas, 'BACKLOG' = sin sprint, o el id de un sprint. */
  filtroSprint = '';
  opcionesSprint: MasterOption[] = [];
  /** Las mismas sin la opción Backlog (en la tarjeta, sin sprint = vacío). */
  opcionesSprintTarjeta: MasterOption[] = [];
  opcionesResponsable: MasterOption[] = [];
  opcionesEstadoProyecto: MasterOption[] = Object.entries(ESTADOS_PROYECTO)
    .map(([k, v]) => ({ value: k, label: v.texto, icon: v.icono, color: v.color }));

  // Modal de tarjeta
  tarjeta: (ItemRequest & { id?: string }) | null = null;
  guardandoTarjeta = false;

  // Equipo
  candidatos: MasterOption[] = [];
  candidatoElegido: string | null = null;
  areasInvitables: MasterOption[] = [];
  areaElegida: string | null = null;

  private catalogoAreas: { id: string; name: string; icon?: string; color?: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private servicio: ProyectoService,
    private adminService: AdminService,
    private breadcrumb: BreadcrumbService,
    private toast: ToastService,
    private sse: SseService,
    private auth: AuthService,
  ) {}

  /** Mensajes del chat sin leer (se ponen en 0 al abrir la pestaña). */
  noLeidos = 0;
  private subChat?: Subscription;

  irA(p: Pestana): void {
    this.pestana = p;
    if (p === 'chat') this.noLeidos = 0;
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.adminService.catalog().subscribe({
      next: (c) => {
        this.catalogoAreas = c.areas || [];
        this.prepararAreasInvitables();
      },
      error: () => undefined,
    });
    this.cargar();
    // ?pestana=chat (desde la lista de proyectos) abre el chat directamente.
    if (this.route.snapshot.queryParamMap.get('pestana') === 'chat') this.irA('chat');
    this.servicio.noLeidos().subscribe({
      next: (m) => (this.noLeidos = this.pestana === 'chat' ? 0 : (m?.[this.id] ?? 0)),
      error: () => undefined,
    });
    const yo = this.auth.currentUserSnapshot()?.idUser;
    this.subChat = this.sse.proyectoChat$.subscribe((m) => {
      if (m.proyectoId === this.id && m.autorId !== yo && this.pestana !== 'chat') this.noLeidos++;
    });
  }

  ngOnDestroy(): void {
    this.breadcrumb.quitar('/proyectos/' + this.id);
    this.subChat?.unsubscribe();
  }

  cargar(): void {
    this.servicio.detalle(this.id).subscribe({
      next: (d) => {
        this.d = d;
        this.cargando = false;
        this.breadcrumb.fijar('/proyectos/' + this.id, { label: d.proyecto.nombre, icon: d.proyecto.icono || undefined });
        this.prepararOpciones();
        this.armarTablero();
        this.prepararAreasInvitables();
        if (d.permisos.agregarMiembros) this.cargarCandidatos();
      },
      error: (e) => {
        this.cargando = false;
        this.toast.error(e?.status === 403 ? 'No participa en este proyecto' : 'No se pudo abrir el proyecto');
        this.router.navigate(['/proyectos']);
      },
    });
  }

  get color(): string {
    return this.d?.proyecto.color || '#062E86';
  }

  // ================================================================ tablero

  armarTablero(): void {
    const t: Record<EstadoItem, ProyectoItem[]> = { POR_HACER: [], EN_CURSO: [], EN_REVISION: [], HECHO: [] };
    for (const i of this.d?.items || []) {
      if (this.filtroSprint === 'BACKLOG' && i.sprintId) continue;
      if (this.filtroSprint && this.filtroSprint !== 'BACKLOG' && i.sprintId !== this.filtroSprint) continue;
      t[i.estado].push(i);
    }
    Object.values(t).forEach((l) => l.sort((a, b) => a.orden - b.orden));
    this.tablero = t;
    this.calcularSegmentos();
  }

  pesoColumna(c: EstadoItem): number {
    return this.tablero[c].reduce((s, i) => s + i.peso, 0);
  }

  /** Reparto del avance por columna (en % del peso total del proyecto), para la barra de colores. */
  segmentos: { clave: EstadoItem; titulo: string; color: string; colorLeyenda: string; icono: string; pct: number; peso: number }[] = [];
  /** Peso que todavía no se ha repartido entre las tarjetas (los pesos son % y suman como máximo 100). */
  pesoLibre = 100;

  /**
   * Cada segmento mide el peso de su columna sobre el 100% del proyecto. Lo
   * hecho va primero y en su color; lo que falta va en tonos apagados y "Por
   * hacer" en gris, para que la barra no parezca llena con 0% de avance.
   */
  private calcularSegmentos(): void {
    const items = this.d?.items || [];
    const total = items.reduce((s, i) => s + i.peso, 0);
    this.pesoLibre = Math.max(0, 100 - total);
    const orden: EstadoItem[] = ['HECHO', 'EN_REVISION', 'EN_CURSO', 'POR_HACER'];
    this.segmentos = orden
      .map((clave) => this.columnas.find((c) => c.clave === clave)!)
      .filter(Boolean)
      .map((c) => {
        const peso = items.filter((i) => i.estado === c.clave).reduce((s, i) => s + i.peso, 0);
        const color = c.clave === 'POR_HACER' ? 'oklch(var(--bc) / 0.18)' : c.clave === 'HECHO' ? c.color : c.color + '99';
        // Sobre 100 o sobre el total si lo pasa: la barra nunca se sale.
        return { ...c, color, colorLeyenda: c.color, peso, pct: Math.round((100 * peso) / Math.max(100, total)) };
      });
  }

  /** Peso máximo para la tarjeta en edición: lo libre más lo que ya tenía. */
  get pesoMaximo(): number {
    const t = this.tarjeta;
    if (!t) return 100;
    const propio = t.id ? (this.d?.items.find((i) => i.id === t.id)?.peso ?? 0) : 0;
    return Math.min(100, this.pesoLibre + propio);
  }

  /** Rango permitido para la fecha límite: el del sprint elegido o, sin sprint, el del proyecto. */
  rangoTarjeta(): { min: string | null; max: string | null } {
    const sp = this.tarjeta?.sprintId ? this.d?.sprints.find((s) => s.id === this.tarjeta?.sprintId) : null;
    return {
      min: sp?.inicio || this.d?.proyecto.inicio || null,
      max: sp?.fin || this.d?.proyecto.fin || null,
    };
  }

  soltar(ev: CdkDragDrop<ProyectoItem[]>, destino: EstadoItem): void {
    if (!this.d?.permisos.editarTablero) return;
    const item = ev.item.data as ProyectoItem;
    if (ev.previousContainer === ev.container) {
      moveItemInArray(ev.container.data, ev.previousIndex, ev.currentIndex);
    } else {
      transferArrayItem(ev.previousContainer.data, ev.container.data, ev.previousIndex, ev.currentIndex);
    }
    // Orden local: posición en la columna. El backend guarda estado y orden.
    ev.container.data.forEach((x, i) => (x.orden = i));
    const anterior = item.estado;
    item.estado = destino;
    this.servicio.moverItem(this.id, item.id, destino, ev.currentIndex).subscribe({
      next: () => this.recalcularAvance(),
      error: (e) => {
        item.estado = anterior;
        this.toast.error(e?.error?.message || 'No se pudo mover la tarjeta');
        this.cargar();
      },
    });
  }

  /** Avance ponderado igual que el backend, para no recargar tras cada arrastre. */
  private recalcularAvance(): void {
    if (!this.d) return;
    // Los pesos son % del proyecto: el avance es la suma de lo HECHO (una sola
    // tarjeta de 40% terminada = 40%, no 100%). Igual que ProyectoService.avance.
    const hecho = this.d.items.filter((i) => i.estado === 'HECHO').reduce((s, i) => s + i.peso, 0);
    const total = this.d.items.reduce((s, i) => s + i.peso, 0);
    // Igual que el backend: si los pesos antiguos pasan de 100, se reparte sobre ese total.
    this.d.proyecto.avance = Math.round((100 * hecho) / Math.max(100, total));
    this.d.proyecto.hechas = this.d.items.filter((i) => i.estado === 'HECHO').length;
    // Mismo ajuste que hace el backend (ProyectoService.sincronizarEstado).
    const p = this.d.proyecto;
    if (p.estado === 'PLANIFICADO' && this.d.items.some((i) => i.estado !== 'POR_HACER')) p.estado = 'EN_CURSO';
    else if (p.estado === 'TERMINADO' && this.d.items.some((i) => i.estado !== 'HECHO')) p.estado = 'EN_CURSO';
    this.calcularSegmentos();
  }

  nuevaTarjeta(estado: EstadoItem = 'POR_HACER'): void {
    const sprint = this.filtroSprint && this.filtroSprint !== 'BACKLOG' ? this.filtroSprint : null;
    if (this.pesoLibre < 1) {
      this.toast.error('Las tarjetas ya reparten el 100% del peso: baje el de alguna antes de crear otra');
      return;
    }
    this.tarjeta = { titulo: '', descripcion: '', estado, peso: Math.min(10, this.pesoLibre), responsableId: null, limite: null, sprintId: sprint };
  }

  editarTarjeta(i: ProyectoItem): void {
    this.tarjeta = {
      id: i.id, titulo: i.titulo, descripcion: i.descripcion, estado: i.estado, peso: i.peso,
      responsableId: i.responsableId, limite: i.limite, sprintId: i.sprintId,
    };
  }

  guardarTarjeta(): void {
    const t = this.tarjeta;
    if (!t || this.guardandoTarjeta) return;
    if (!t.titulo?.trim()) {
      this.toast.error('Escriba el título de la tarjeta');
      return;
    }
    const peso = Number(t.peso) || 0;
    if (peso < 1 || peso > this.pesoMaximo) {
      this.toast.error(`El peso debe ir de 1 a ${this.pesoMaximo}%: entre todas las tarjetas no pasan de 100%`);
      return;
    }
    const { min, max } = this.rangoTarjeta();
    if (t.limite && ((min && t.limite < min) || (max && t.limite > max))) {
      this.toast.error(`La fecha límite debe estar entre ${min || '…'} y ${max || '…'}`);
      return;
    }
    // Se marca como guardando solo después de validar: antes se marcaba primero
    // y, si la validación fallaba, el botón se quedaba girando para siempre.
    this.guardandoTarjeta = true;
    const nueva = !t.id;
    const req: ItemRequest = { ...t, titulo: t.titulo.trim(), peso };
    const llamada = t.id ? this.servicio.editarItem(this.id, t.id, req) : this.servicio.crearItem(this.id, req);
    llamada.subscribe({
      next: () => {
        this.guardandoTarjeta = false;
        this.tarjeta = null;
        this.toast.success(nueva ? 'Tarjeta creada' : 'Tarjeta actualizada');
        this.cargar();
      },
      error: (e) => {
        this.guardandoTarjeta = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar la tarjeta');
      },
    });
  }

  eliminarTarjeta(): void {
    const t = this.tarjeta;
    if (!t?.id) return;
    this.confirmar('¿Eliminar la tarjeta?', t.titulo).then((ok) => {
      if (!ok) return;
      this.servicio.eliminarItem(this.id, t.id!).subscribe({
        next: () => {
          this.tarjeta = null;
          this.toast.success('Tarjeta eliminada');
          this.cargar();
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar'),
      });
    });
  }

  nombreSprint(id: string | null): string | null {
    return id ? this.d?.sprints.find((s) => s.id === id)?.nombre ?? null : null;
  }

  // ================================================================ proyecto

  /**
   * Valor que muestra el selector de estado. Si el servidor rechaza el cambio,
   * se fuerza a volver al estado real: si no, el selector se quedaba mostrando
   * "Terminado" aunque el proyecto no había cambiado.
   */
  estadoVista: EstadoProyecto | null = null;

  cambiarEstado(estado: EstadoProyecto): void {
    if (!this.d || estado === this.d.proyecto.estado) return;
    const p = this.d.proyecto;
    this.servicio.editar(this.id, {
      nombre: p.nombre, descripcion: p.descripcion, estado, icono: p.icono, color: p.color, inicio: p.inicio, fin: p.fin,
    }).subscribe({
      next: () => {
        p.estado = estado;
        this.toast.success('Estado actualizado');
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'No se pudo cambiar el estado');
        this.estadoVista = estado;
        setTimeout(() => (this.estadoVista = null));
      },
    });
  }

  editarProyecto(): void {
    if (!this.d) return;
    const p = this.d.proyecto;
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: 'Editar proyecto',
      html: `<input id="pr-nombre" class="swal2-input" maxlength="150" placeholder="Nombre">
             <textarea id="pr-desc" class="swal2-textarea" placeholder="Descripción"></textarea>
             <div style="display:flex;gap:8px;justify-content:center"><input id="pr-ini" type="date" class="swal2-input" style="width:45%">
             <input id="pr-fin" type="date" class="swal2-input" style="width:45%"></div>`,
      didOpen: () => {
        (document.getElementById('pr-nombre') as HTMLInputElement).value = p.nombre;
        (document.getElementById('pr-desc') as HTMLTextAreaElement).value = p.descripcion || '';
        (document.getElementById('pr-ini') as HTMLInputElement).value = p.inicio || '';
        (document.getElementById('pr-fin') as HTMLInputElement).value = p.fin || '';
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const nombre = (document.getElementById('pr-nombre') as HTMLInputElement).value.trim();
        if (!nombre) {
          Swal.showValidationMessage('Ponga un nombre');
          return false;
        }
        return {
          nombre,
          descripcion: (document.getElementById('pr-desc') as HTMLTextAreaElement).value,
          inicio: (document.getElementById('pr-ini') as HTMLInputElement).value || null,
          fin: (document.getElementById('pr-fin') as HTMLInputElement).value || null,
        };
      },
    }).then((r) => {
      if (!r.isConfirmed || !r.value) return;
      this.servicio.editar(this.id, { ...r.value, estado: p.estado, icono: p.icono, color: p.color }).subscribe({
        next: () => this.cargar(),
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo guardar'),
      });
    });
  }

  eliminarProyecto(): void {
    if (!this.d) return;
    this.confirmar('¿Eliminar el proyecto?', this.d.proyecto.nombre).then((ok) => {
      if (!ok) return;
      this.servicio.eliminar(this.id).subscribe({
        next: () => {
          this.toast.success('Proyecto eliminado');
          this.router.navigate(['/proyectos']);
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar'),
      });
    });
  }

  // ================================================================ sprints

  editarSprint(s?: ProyectoSprint): void {
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: s ? 'Editar sprint' : 'Nuevo sprint',
      html: `<input id="sp-nombre" class="swal2-input" maxlength="120" placeholder="Nombre (ej.: Sprint 1)">
             <input id="sp-obj" class="swal2-input" maxlength="500" placeholder="Objetivo del sprint">
             <div style="display:flex;gap:8px;justify-content:center"><input id="sp-ini" type="date" class="swal2-input" style="width:45%">
             <input id="sp-fin" type="date" class="swal2-input" style="width:45%"></div>`,
      didOpen: () => {
        (document.getElementById('sp-nombre') as HTMLInputElement).value = s?.nombre || '';
        (document.getElementById('sp-obj') as HTMLInputElement).value = s?.objetivo || '';
        (document.getElementById('sp-ini') as HTMLInputElement).value = s?.inicio || '';
        (document.getElementById('sp-fin') as HTMLInputElement).value = s?.fin || '';
        // El sprint vive dentro del plazo del proyecto.
        for (const idCampo of ['sp-ini', 'sp-fin']) {
          const campo = document.getElementById(idCampo) as HTMLInputElement;
          if (this.d?.proyecto.inicio) campo.min = this.d.proyecto.inicio;
          if (this.d?.proyecto.fin) campo.max = this.d.proyecto.fin;
        }
      },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const nombre = (document.getElementById('sp-nombre') as HTMLInputElement).value.trim();
        const inicio = (document.getElementById('sp-ini') as HTMLInputElement).value || null;
        const fin = (document.getElementById('sp-fin') as HTMLInputElement).value || null;
        if (!nombre) {
          Swal.showValidationMessage('Ponga un nombre');
          return false;
        }
        if (inicio && fin && fin < inicio) {
          Swal.showValidationMessage('El fin es anterior al inicio');
          return false;
        }
        const pIni = this.d?.proyecto.inicio;
        const pFin = this.d?.proyecto.fin;
        if ((pIni && ((inicio && inicio < pIni) || (fin && fin < pIni))) || (pFin && ((inicio && inicio > pFin) || (fin && fin > pFin)))) {
          Swal.showValidationMessage(`El sprint debe estar dentro del proyecto (${pIni || '…'} a ${pFin || '…'})`);
          return false;
        }
        return { nombre, objetivo: (document.getElementById('sp-obj') as HTMLInputElement).value, inicio, fin } as SprintRequest;
      },
    }).then((r) => {
      if (!r.isConfirmed || !r.value) return;
      const req: SprintRequest = { ...r.value, estado: s?.estado };
      const llamada: Observable<unknown> = s
        ? this.servicio.editarSprint(this.id, s.id, req)
        : this.servicio.crearSprint(this.id, req);
      llamada.subscribe({
        next: () => this.cargar(),
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo guardar el sprint'),
      });
    });
  }

  estadoSprint(s: ProyectoSprint, estado: string): void {
    this.servicio.editarSprint(this.id, s.id, { nombre: s.nombre, objetivo: s.objetivo, inicio: s.inicio, fin: s.fin,
      estado: estado as ProyectoSprint['estado'] }).subscribe({
      next: () => this.cargar(),
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo cambiar el estado'),
    });
  }

  eliminarSprint(s: ProyectoSprint): void {
    this.confirmar('¿Eliminar el sprint?', `${s.nombre}. Sus tarjetas vuelven al backlog.`).then((ok) => {
      if (!ok) return;
      this.servicio.eliminarSprint(this.id, s.id).subscribe({
        next: () => this.cargar(),
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar'),
      });
    });
  }

  verSprint(s: ProyectoSprint): void {
    this.filtroSprint = s.id;
    this.armarTablero();
    this.pestana = 'tablero';
  }

  // ================================================================ objetivos y logros

  get logros(): ProyectoObjetivo[] {
    return (this.d?.objetivos || []).filter((o) => !!o.logradoAt);
  }

  nuevoObjetivo(): void {
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: 'Nuevo objetivo', input: 'text', inputPlaceholder: 'Ej.: Reducir a 2 h el tiempo de atención',
      showCancelButton: true, confirmButtonText: 'Añadir', cancelButtonText: 'Cancelar',
      inputValidator: (v) => (v?.trim() ? null : 'Describa el objetivo'),
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.servicio.crearObjetivo(this.id, String(r.value).trim()).subscribe({
        next: () => this.cargar(),
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo añadir'),
      });
    });
  }

  /** Marcar como logrado pide una nota (qué se consiguió); desmarcar no pide nada. */
  alternarLogro(o: ProyectoObjetivo): void {
    if (o.logradoAt) {
      this.servicio.marcarLogro(this.id, o.id, false).subscribe({ next: () => this.cargar() });
      return;
    }
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: '¡Objetivo logrado!', text: o.descripcion, input: 'textarea',
      inputPlaceholder: '¿Qué se consiguió? (opcional)', showCancelButton: true,
      confirmButtonText: 'Registrar logro', cancelButtonText: 'Cancelar',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.servicio.marcarLogro(this.id, o.id, true, r.value).subscribe({
        next: () => {
          this.toast.success('Logro registrado');
          this.cargar();
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo registrar'),
      });
    });
  }

  eliminarObjetivo(o: ProyectoObjetivo): void {
    this.confirmar('¿Eliminar el objetivo?', o.descripcion).then((ok) => {
      if (!ok) return;
      this.servicio.eliminarObjetivo(this.id, o.id).subscribe({ next: () => this.cargar() });
    });
  }

  // ================================================================ equipo y áreas

  private cargarCandidatos(): void {
    this.servicio.candidatos(this.id).subscribe({
      next: (l) => (this.candidatos = (l || []).map((p) => ({
        value: p.userId, label: p.nombre, icon: 'fa-solid fa-user', detail: [p.correo, p.area].filter(Boolean).join(' · '),
      }))),
      error: () => (this.candidatos = []),
    });
  }

  agregarMiembro(): void {
    if (!this.candidatoElegido) return;
    this.servicio.agregarMiembro(this.id, this.candidatoElegido).subscribe({
      next: () => {
        this.candidatoElegido = null;
        this.toast.success('Añadido al equipo');
        this.cargar();
      },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo añadir'),
    });
  }

  quitarMiembro(m: ProyectoMiembro): void {
    this.confirmar('¿Quitar del equipo?', m.nombre).then((ok) => {
      if (!ok) return;
      this.servicio.quitarMiembro(this.id, m.userId).subscribe({
        next: () => this.cargar(),
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo quitar'),
      });
    });
  }

  invitarArea(): void {
    if (!this.areaElegida) return;
    this.servicio.invitarArea(this.id, this.areaElegida).subscribe({
      next: () => {
        this.areaElegida = null;
        this.toast.success('Invitación enviada: su jefe la verá al momento');
        this.cargar();
      },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo invitar'),
    });
  }

  quitarArea(areaId: string, nombre: string): void {
    this.confirmar('¿Quitar el área del proyecto?', `${nombre}. Su gente también sale del equipo.`).then((ok) => {
      if (!ok) return;
      this.servicio.quitarArea(this.id, areaId).subscribe({ next: () => this.cargar() });
    });
  }

  colorArea(estado: string): string {
    return estado === 'ACEPTADA' ? '#16A34A' : estado === 'RECHAZADA' ? '#DC2626' : '#D97706';
  }

  // ================================================================ apoyo

  private prepararOpciones(): void {
    const d = this.d!;
    this.opcionesSprint = [
      { value: 'BACKLOG', label: 'Backlog (sin sprint)', icon: 'fa-solid fa-inbox', color: '#64748B' },
      ...d.sprints.map((s) => ({ value: s.id, label: s.nombre, icon: ESTADOS_SPRINT[s.estado].icono, color: ESTADOS_SPRINT[s.estado].color })),
    ];
    this.opcionesSprintTarjeta = this.opcionesSprint.slice(1);
    this.opcionesResponsable = d.miembros.map((m) => ({ value: m.userId, label: m.nombre, icon: 'fa-solid fa-user', detail: m.area }));
  }

  private prepararAreasInvitables(): void {
    if (!this.d) return;
    const usadas = new Set([this.d.proyecto.areaId, ...this.d.areas.filter((a) => a.estado !== 'RECHAZADA').map((a) => a.areaId)]);
    this.areasInvitables = this.catalogoAreas.filter((a) => !usadas.has(a.id))
      .map((a) => ({ value: a.id, label: a.name, icon: a.icon, color: a.color }));
  }

  private confirmar(titulo: string, texto: string): Promise<boolean> {
    return confirmar({ titulo, texto });
  }

  trackItem(_: number, i: ProyectoItem): string {
    return i.id;
  }

  trackObjetivo(_: number, o: ProyectoObjetivo): string {
    return o.id;
  }
}

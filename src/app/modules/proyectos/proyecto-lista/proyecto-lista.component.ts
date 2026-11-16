import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ESTADOS_PROYECTO, InvitacionProyecto, ProyectoArea, ProyectoMiembro, ProyectoObjetivo, ProyectoRequest, ProyectoResumen,
  ProyectoSprint, SprintRequest,
} from '../../../models/proyecto.model';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

/**
 * Proyectos que ve la persona y, si es jefe, las invitaciones de otras áreas
 * pendientes de aceptar. Crean proyectos los jefes (de su área) y el súper admin.
 */
@Component({
  selector: 'app-proyecto-lista',
  templateUrl: './proyecto-lista.component.html',
})
export class ProyectoListaComponent implements OnInit {
  proyectos: ProyectoResumen[] = [];
  invitaciones: InvitacionProyecto[] = [];
  cargando = false;
  puedeCrear = false;
  esSuperAdmin = false;
  readonly estados = ESTADOS_PROYECTO;

  // Modal de alta
  creando = false;
  guardando = false;
  form: ProyectoRequest = this.vacio();
  areas: MasterOption[] = [];
  readonly iconos = [
    'fa-solid fa-diagram-project', 'fa-solid fa-rocket', 'fa-solid fa-bullseye', 'fa-solid fa-code',
    'fa-solid fa-server', 'fa-solid fa-people-group', 'fa-solid fa-chart-line', 'fa-solid fa-lightbulb',
  ];
  readonly colores = ['#062E86', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#475569'];

  // ---- Asistente por pasos. El proyecto se crea al terminar el paso 1; los
  // demás pasos lo completan con las mismas llamadas del detalle, así que
  // cerrar a mitad de camino deja el proyecto creado con lo que se alcanzó.
  readonly pasos = [
    { titulo: 'Datos', icono: 'fa-solid fa-pen-ruler' },
    { titulo: 'Integrantes', icono: 'fa-solid fa-user-group' },
    { titulo: 'Otras áreas', icono: 'fa-solid fa-building' },
    { titulo: 'Sprints', icono: 'fa-solid fa-flag-checkered' },
    { titulo: 'Objetivos', icono: 'fa-solid fa-bullseye' },
  ];
  paso = 0;
  /** Proyecto ya creado en el paso 1 (null mientras no). */
  creado: ProyectoResumen | null = null;
  candidatos: ProyectoMiembro[] = [];
  miembros: ProyectoMiembro[] = [];
  areasInvitadas: ProyectoArea[] = [];
  areaAInvitar: string | null = null;
  sprints: ProyectoSprint[] = [];
  sprint: SprintRequest = { nombre: '', objetivo: '', inicio: null, fin: null };
  objetivos: ProyectoObjetivo[] = [];
  objetivoNuevo = '';
  ocupado = false;
  /** Todas las áreas (para invitar), sin la dueña. */
  todasLasAreas: MasterOption[] = [];

  constructor(
    private servicio: ProyectoService,
    private adminService: AdminService,
    private authService: AuthService,
    private toast: ToastService,
    private router: Router,
  ) {
    const rol = this.authService.getRole();
    this.esSuperAdmin = rol === 'SUPER_ADMIN';
    this.puedeCrear = rol === 'SUPER_ADMIN' || rol === 'AREA_MANAGER';
  }

  /** Mensajes del chat sin leer por proyecto. */
  noLeidos: Record<string, number> = {};

  ngOnInit(): void {
    this.cargar();
    this.servicio.noLeidos().subscribe({ next: (m) => (this.noLeidos = m || {}), error: () => undefined });
    if (this.authService.getRole() === 'AREA_MANAGER') this.cargarInvitaciones();
    if (this.puedeCrear) {
      this.adminService.catalog().subscribe({
        next: (c) => {
          this.areas = (c.areas || []).filter((a) => a.status !== false).map((a) => ({ value: a.id, label: a.name, icon: a.icon, color: a.color }));
          this.todasLasAreas = this.areas;
        },
        error: () => undefined,
      });
    }
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.listar().subscribe({
      next: (l) => {
        this.proyectos = l || [];
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar los proyectos');
      },
    });
  }

  private cargarInvitaciones(): void {
    this.servicio.invitaciones().subscribe({ next: (l) => (this.invitaciones = l || []), error: () => undefined });
  }

  abrir(p: ProyectoResumen): void {
    this.router.navigate(['/proyectos', p.id]);
  }

  abrirChat(p: ProyectoResumen, ev: Event): void {
    ev.stopPropagation();
    this.router.navigate(['/proyectos', p.id], { queryParams: { pestana: 'chat' } });
  }

  /** El jefe del área invitada acepta o rechaza (con motivo opcional). */
  decidir(inv: InvitacionProyecto, aceptar: boolean): void {
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280',
      title: aceptar ? '¿Aceptar la invitación?' : '¿Rechazar la invitación?',
      text: `Proyecto "${inv.proyecto}" de ${inv.areaDuena}.` + (aceptar ? ' Su área podrá sumar gente al equipo.' : ''),
      input: 'text',
      inputPlaceholder: aceptar ? 'Comentario (opcional)' : 'Motivo (opcional)',
      showCancelButton: true,
      confirmButtonText: aceptar ? 'Aceptar' : 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: aceptar ? '#16A34A' : '#DC2626',
    }).then((r) => {
      if (!r.isConfirmed) return;
      const areaId = this.authService.areasACargo()[0];
      this.servicio.decidir(inv.proyectoId, areaId, aceptar, r.value).subscribe({
        next: () => {
          this.toast.success(aceptar ? 'Invitación aceptada' : 'Invitación rechazada');
          this.invitaciones = this.invitaciones.filter((x) => x.proyectoId !== inv.proyectoId);
          this.cargar();
        },
        error: (e) => this.toast.error(e?.error?.message || 'No se pudo responder'),
      });
    });
  }

  nuevo(): void {
    this.form = this.vacio();
    this.paso = 0;
    this.creado = null;
    this.candidatos = [];
    this.miembros = [];
    this.areasInvitadas = [];
    this.sprints = [];
    this.objetivos = [];
    this.sprint = { nombre: '', objetivo: '', inicio: null, fin: null };
    this.objetivoNuevo = '';
    this.creando = true;
  }

  /** Paso 1 → crea (o actualiza) el proyecto y sigue; los demás pasos son opcionales. */
  siguiente(): void {
    if (this.paso === 0) {
      this.guardarDatos();
      return;
    }
    if (this.paso < this.pasos.length - 1) this.irAPaso(this.paso + 1);
  }

  irAPaso(i: number): void {
    // Sin proyecto creado solo existe el paso 1.
    if (i < 0 || i >= this.pasos.length || (i > 0 && !this.creado)) return;
    this.paso = i;
    if (i === 1) this.cargarEquipo();
  }

  get esUltimoPaso(): boolean {
    return this.paso === this.pasos.length - 1;
  }

  /** Cierra el asistente; si el proyecto ya existe, lo abre. */
  terminar(): void {
    this.creando = false;
    if (this.creado) {
      this.router.navigate(['/proyectos', this.creado.id]);
    }
  }

  cerrarAsistente(): void {
    if (this.guardando) return;
    this.creando = false;
    // Ya creado: que aparezca en la lista aunque se cierre a mitad de camino.
    if (this.creado) this.cargar();
  }

  private guardarDatos(): void {
    if (!this.formValido || this.guardando) return;
    this.guardando = true;
    const datos = { ...this.form, nombre: this.form.nombre.trim() };
    const llamada = this.creado ? this.servicio.editar(this.creado.id, datos) : this.servicio.crear(datos);
    llamada.subscribe({
      next: (p) => {
        this.guardando = false;
        if (!this.creado) this.toast.success('Proyecto creado; ahora arme su equipo');
        this.creado = p;
        this.irAPaso(1);
      },
      error: (e) => {
        this.guardando = false;
        this.toast.error(e?.error?.message || 'No se pudo guardar el proyecto');
      },
    });
  }

  private cargarEquipo(): void {
    if (!this.creado) return;
    const id = this.creado.id;
    this.servicio.candidatos(id).subscribe({ next: (l) => (this.candidatos = l || []), error: () => undefined });
    this.servicio.detalle(id).subscribe({
      next: (d) => {
        this.miembros = d.miembros || [];
        this.areasInvitadas = (d.areas || []).filter((a) => a.areaId !== this.creado?.areaId);
        this.recalcularAreas();
        this.sprints = d.sprints || [];
        this.objetivos = d.objetivos || [];
      },
      error: () => undefined,
    });
  }

  agregar(m: ProyectoMiembro, rol: 'RESPONSABLE' | 'MIEMBRO' = 'MIEMBRO'): void {
    if (!this.creado || this.ocupado) return;
    this.ocupado = true;
    this.servicio.agregarMiembro(this.creado.id, m.userId, rol).subscribe({
      next: () => {
        this.ocupado = false;
        this.candidatos = this.candidatos.filter((x) => x.userId !== m.userId);
        this.miembros = [...this.miembros, { ...m, rol }];
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo agregar');
      },
    });
  }

  quitar(m: ProyectoMiembro): void {
    if (!this.creado || this.ocupado) return;
    this.ocupado = true;
    this.servicio.quitarMiembro(this.creado.id, m.userId).subscribe({
      next: () => {
        this.ocupado = false;
        this.miembros = this.miembros.filter((x) => x.userId !== m.userId);
        this.candidatos = [...this.candidatos, { ...m, rol: null }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo quitar');
      },
    });
  }

  /** Áreas que se pueden invitar (campo, no getter: el select no debe recibir una lista nueva en cada ciclo). */
  areasParaInvitar: MasterOption[] = [];

  /** Todas menos la dueña y las ya invitadas. */
  private recalcularAreas(): void {
    const usadas = new Set([this.creado?.areaId, ...this.areasInvitadas.map((a) => a.areaId)]);
    this.areasParaInvitar = this.todasLasAreas.filter((a) => !usadas.has(a.value as string));
  }

  invitar(): void {
    const areaId = this.areaAInvitar;
    if (!this.creado || !areaId || this.ocupado) return;
    this.ocupado = true;
    this.servicio.invitarArea(this.creado.id, areaId).subscribe({
      next: () => {
        this.ocupado = false;
        const nombre = this.todasLasAreas.find((a) => a.value === areaId)?.label || '';
        this.areasInvitadas = [...this.areasInvitadas,
          { areaId, nombre, estado: 'PENDIENTE', motivo: null, decididoAt: null }];
        this.recalcularAreas();
        this.areaAInvitar = null;
        this.toast.success('Invitación enviada; el jefe de esa área debe aceptarla');
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo invitar');
      },
    });
  }

  /** Por qué no se puede agregar el sprint (null = se puede). */
  get motivoSprint(): string | null {
    const s = this.sprint;
    const ini = this.form.inicio;
    const fin = this.form.fin;
    if (!s.nombre.trim()) return s.inicio || s.fin ? 'Escriba el nombre del sprint' : null;
    if (s.inicio && s.fin && s.fin < s.inicio) return 'El fin del sprint es anterior a su inicio';
    const fuera = (f?: string | null) => !!f && ((!!ini && f < ini) || (!!fin && f > fin));
    if (fuera(s.inicio) || fuera(s.fin)) return `El sprint debe quedar dentro del proyecto (${ini || '…'} a ${fin || '…'})`;
    return null;
  }

  /** Por qué no se puede crear el proyecto (null = se puede). */
  get motivoProyecto(): string | null {
    if (!this.form.nombre?.trim()) return 'Escriba el nombre del proyecto';
    if (this.esSuperAdmin && !this.form.areaId) return 'Elija el área dueña';
    if (this.form.inicio && this.form.fin && this.form.fin < this.form.inicio) return 'La fecha de fin es anterior a la de inicio';
    return null;
  }

  get sprintValido(): boolean {
    const s = this.sprint;
    const ini = this.form.inicio;
    const fin = this.form.fin;
    const dentro = (f?: string | null) => !f || ((!ini || f >= ini) && (!fin || f <= fin));
    return !!s.nombre.trim() && (!s.inicio || !s.fin || s.fin >= s.inicio) && dentro(s.inicio) && dentro(s.fin);
  }

  agregarSprint(): void {
    if (!this.creado || !this.sprintValido || this.ocupado) return;
    this.ocupado = true;
    this.servicio.crearSprint(this.creado.id, { ...this.sprint, nombre: this.sprint.nombre.trim() }).subscribe({
      next: (sp) => {
        this.ocupado = false;
        this.sprints = [...this.sprints, sp];
        // El siguiente sprint arranca donde terminó este.
        this.sprint = { nombre: '', objetivo: '', inicio: this.sprint.fin || null, fin: null };
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo crear el sprint');
      },
    });
  }

  quitarSprint(sp: ProyectoSprint): void {
    if (!this.creado || this.ocupado) return;
    this.ocupado = true;
    this.servicio.eliminarSprint(this.creado.id, sp.id).subscribe({
      next: () => {
        this.ocupado = false;
        this.sprints = this.sprints.filter((x) => x.id !== sp.id);
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo quitar el sprint');
      },
    });
  }

  agregarObjetivo(): void {
    const texto = this.objetivoNuevo.trim();
    if (!this.creado || !texto || this.ocupado) return;
    this.ocupado = true;
    this.servicio.crearObjetivo(this.creado.id, texto).subscribe({
      next: (o) => {
        this.ocupado = false;
        this.objetivos = [...this.objetivos, o];
        this.objetivoNuevo = '';
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo agregar el objetivo');
      },
    });
  }

  quitarObjetivo(o: ProyectoObjetivo): void {
    if (!this.creado || this.ocupado) return;
    this.ocupado = true;
    this.servicio.eliminarObjetivo(this.creado.id, o.id).subscribe({
      next: () => {
        this.ocupado = false;
        this.objetivos = this.objetivos.filter((x) => x.id !== o.id);
      },
      error: (e) => {
        this.ocupado = false;
        this.toast.error(e?.error?.message || 'No se pudo quitar el objetivo');
      },
    });
  }

  trackMiembro(_: number, m: ProyectoMiembro): string {
    return m.userId;
  }

  get formValido(): boolean {
    return !!this.form.nombre?.trim() && (!this.esSuperAdmin || !!this.form.areaId)
      && (!this.form.inicio || !this.form.fin || this.form.fin >= this.form.inicio);
  }

  colorDe(p: ProyectoResumen): string {
    return p.color || '#062E86';
  }

  trackProyecto(_: number, p: ProyectoResumen): string {
    return p.id;
  }

  private vacio(): ProyectoRequest {
    return { nombre: '', descripcion: '', areaId: null, icono: 'fa-solid fa-diagram-project', color: '#2563EB', inicio: null, fin: null };
  }
}

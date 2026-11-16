import { Component, OnInit } from '@angular/core';
import { METODOS_ASIGNACION } from '../../../core/utils/opciones-select.util';
import Swal from 'sweetalert2';
import { AdminService, MiembroEquipo, RoutingConfig, SupportTeam } from '../../../core/services/admin.service';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { AuthService } from '../../../core/services/auth.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-team-management',
  templateUrl: './team-management.component.html'
})
export class TeamManagementComponent implements OnInit {
  readonly metodosAsignacion = METODOS_ASIGNACION;
  teams: SupportTeam[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagTeams = new Paginacion<SupportTeam>(() => this.teams);
  loading = false;
  showCreate = false;
  newTeam: Partial<SupportTeam> = { activeTeam: true, assignmentMethod: 'ROUND_ROBIN', iconTeam: 'fa-solid fa-users', colorTeam: '#2563EB' };
  editTeam: SupportTeam | null = null;

  /** Interruptor global de asignación automática (solo lo edita el SUPER_ADMIN). */
  routing: RoutingConfig = { id: '', autoAssignEnabled: true, notifyUnassigned: false };
  savingRouting = false;
  isSuperAdmin = false;

  methods = ['ROUND_ROBIN', 'LEAST_ASSIGNED', 'MANUAL'];

  /** Áreas del catálogo: cada equipo atiende los tickets de una (V28). */
  areas: { id: string; name: string; icon?: string; color?: string }[] = [];
  areaOpciones: { value: string; label: string; icon?: string; color?: string }[] = [];

  areaDe(id?: string | null): { name: string; icon?: string; color?: string } | null {
    return this.areas.find((a) => a.id === id) ?? null;
  }

  private emptyTeam(): Partial<SupportTeam> {
    return { activeTeam: true, assignmentMethod: 'ROUND_ROBIN', iconTeam: 'fa-solid fa-users', colorTeam: '#2563EB' };
  }

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.authService.getRole() === 'SUPER_ADMIN';
    this.loadTeams();
    // La asignación automática global es del súper admin.
    if (this.isSuperAdmin) this.loadRouting();
    this.adminService.catalog().subscribe({
      next: (c) => {
        this.areas = (c.areas || []).filter((a) => a.status !== false);
        // El jefe solo crea y mueve equipos entre las áreas a su cargo.
        const mias = this.isSuperAdmin ? null : this.authService.areasACargo();
        this.areaOpciones = this.areas
          .filter((a) => !mias || mias.includes(a.id))
          .map((a) => ({ value: a.id, label: a.name, icon: a.icon, color: a.color }));
        if (!this.newTeam.areaId && this.areaOpciones.length === 1) {
          this.newTeam.areaId = this.areaOpciones[0].value;
        }
      },
      error: () => undefined,
    });
  }

  private loadRouting(): void {
    this.adminService.getRoutingConfig().subscribe({
      next: (cfg) => (this.routing = { ...this.routing, ...cfg }),
      error: () => undefined
    });
  }

  saveRouting(): void {
    this.savingRouting = true;
    this.adminService.updateRoutingConfig(this.routing).subscribe({
      next: (cfg) => {
        this.routing = { ...this.routing, ...cfg };
        this.savingRouting = false;
        this.toastService.success('Configuración de asignación actualizada');
      },
      error: (e) => {
        this.savingRouting = false;
        this.toastService.error(e?.error?.message || 'No se pudo guardar la configuración');
      }
    });
  }

  loadTeams(): void {
    this.loading = true;
    this.adminService.getTeams().subscribe({
      next: (t) => { this.teams = t; this.loading = false; },
      error: () => { this.loading = false; this.toastService.error('No se pudieron cargar los equipos'); }
    });
  }

  create(): void {
    if (!this.newTeam.nameTeam) return;
    this.adminService.createTeam(this.newTeam).subscribe({
      next: () => { this.loadTeams(); this.newTeam = this.emptyTeam(); this.toastService.success('Equipo creado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  edit(team: SupportTeam): void {
    this.editTeam = { ...team, colorTeam: team.colorTeam || '#062e86' };
  }

  saveEdit(): void {
    if (!this.editTeam) return;
    this.adminService.updateTeam(this.editTeam.idTeam, this.editTeam).subscribe({
      next: () => { this.loadTeams(); this.editTeam = null; this.toastService.success('Equipo actualizado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar')
    });
  }

  // ============================ MIEMBROS ============================

  /** Equipo cuyo modal de miembros está abierto. */
  equipoMiembros: SupportTeam | null = null;
  miembros: MiembroEquipo[] = [];
  candidatos: MasterOption[] = [];
  candidatoElegido: string | null = null;
  cargandoMiembros = false;
  guardandoMiembro = false;

  abrirMiembros(team: SupportTeam): void {
    this.equipoMiembros = team;
    this.candidatoElegido = null;
    this.cargarMiembros();
  }

  cerrarMiembros(): void {
    this.equipoMiembros = null;
    this.miembros = [];
    this.candidatos = [];
  }

  private cargarMiembros(): void {
    const team = this.equipoMiembros;
    if (!team) return;
    this.cargandoMiembros = true;
    this.adminService.teamMembers(team.idTeam).subscribe({
      next: (m) => {
        this.miembros = m || [];
        this.cargandoMiembros = false;
      },
      error: () => {
        this.cargandoMiembros = false;
        this.toastService.error('No se pudieron cargar los miembros');
      },
    });
    this.adminService.teamCandidatos(team.idTeam).subscribe({
      next: (c) => (this.candidatos = (c || []).map((p) => ({
        value: p.idUser,
        label: p.nombre,
        icon: p.rol === 'AREA_MANAGER' ? 'fa-solid fa-user-tie' : 'fa-solid fa-headset',
        detail: [p.correo, p.area].filter(Boolean).join(' · '),
      }))),
      error: () => (this.candidatos = []),
    });
  }

  agregarMiembro(): void {
    const team = this.equipoMiembros;
    if (!team || !this.candidatoElegido || this.guardandoMiembro) return;
    this.guardandoMiembro = true;
    this.adminService.addMemberToTeam(team.idTeam, this.candidatoElegido).subscribe({
      next: () => {
        this.guardandoMiembro = false;
        this.candidatoElegido = null;
        this.toastService.success('Miembro añadido');
        this.cargarMiembros();
      },
      error: (err) => {
        this.guardandoMiembro = false;
        this.toastService.error(err?.error?.message || 'No se pudo añadir');
      },
    });
  }

  quitarMiembro(m: MiembroEquipo): void {
    const team = this.equipoMiembros;
    if (!team) return;
    this.adminService.removeMemberFromTeam(team.idTeam, m.idUser).subscribe({
      next: () => {
        this.toastService.success(`${m.nombre} ya no está en el equipo`);
        this.cargarMiembros();
      },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo quitar'),
    });
  }

  trackMiembro(_: number, m: MiembroEquipo): string {
    return m.idUser;
  }

  cancelEdit(): void {
    this.editTeam = null;
  }

  delete(team: SupportTeam): void {
    Swal.fire({ reverseButtons: true, cancelButtonColor: '#6b7280', cancelButtonText: 'Cancelar', confirmButtonText: 'Sí, eliminar', focusCancel: true,
      title: '¿Eliminar equipo?',
      text: team.nameTeam,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626'
    }).then((r) => {
      if (r.isConfirmed) {
        this.adminService.deleteTeam(team.idTeam).subscribe({
          next: () => { this.loadTeams(); this.toastService.success('Equipo eliminado'); },
          error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar')
        });
      }
    });
  }

  getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      ROUND_ROBIN: 'Rotativo',
      LEAST_ASSIGNED: 'Menos asignados',
      MANUAL: 'Manual'
    };
    return labels[method] || method;
  }

  /** Icono Font Awesome del método de asignación. */
  methodIcon(method: string): string {
    const icons: Record<string, string> = {
      ROUND_ROBIN: 'fa-solid fa-arrows-rotate',
      LEAST_ASSIGNED: 'fa-solid fa-scale-balanced',
      MANUAL: 'fa-solid fa-hand-pointer'
    };
    return icons[method] || 'fa-solid fa-shuffle';
  }

  methodBadgeClass(method: string): string {
    const classes: Record<string, string> = {
      ROUND_ROBIN: 'badge-info',
      LEAST_ASSIGNED: 'badge-warning',
      MANUAL: 'badge-neutral'
    };
    return classes[method] || 'badge-ghost';
  }

  /** Color del método de asignación, equivalente a methodBadgeClass pero en hex. */
  methodColor(method: string): string {
    const colors: Record<string, string> = {
      ROUND_ROBIN: '#2563EB',
      LEAST_ASSIGNED: '#D97706',
      MANUAL: '#64748B'
    };
    return colors[method] || '#94A3B8';
  }
}
import { Component, OnInit } from '@angular/core';
import { METODOS_ASIGNACION } from '../../../core/utils/opciones-select.util';
import Swal from 'sweetalert2';
import { AdminService, RoutingConfig, SupportTeam } from '../../../core/services/admin.service';
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
    this.loadRouting();
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
    this.editTeam = { ...team };
  }

  saveEdit(): void {
    if (!this.editTeam) return;
    this.adminService.updateTeam(this.editTeam.idTeam, this.editTeam).subscribe({
      next: () => { this.loadTeams(); this.editTeam = null; this.toastService.success('Equipo actualizado'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo actualizar')
    });
  }

  cancelEdit(): void {
    this.editTeam = null;
  }

  delete(team: SupportTeam): void {
    Swal.fire({
      title: '¿Eliminar equipo?',
      text: team.nameTeam,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33'
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
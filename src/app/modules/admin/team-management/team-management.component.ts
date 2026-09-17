import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, SupportTeam } from '../../../core/services/admin.service';

@Component({
  selector: 'app-team-management',
  templateUrl: './team-management.component.html'
})
export class TeamManagementComponent implements OnInit {
  teams: SupportTeam[] = [];
  loading = false;
  showCreate = false;
  newTeam: Partial<SupportTeam> = { activeTeam: true, assignmentMethod: 'ROUND_ROBIN' };
  editTeam: SupportTeam | null = null;

  methods = ['ROUND_ROBIN', 'LEAST_ASSIGNED', 'MANUAL'];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams(): void {
    this.loading = true;
    this.adminService.getTeams().subscribe({
      next: (t) => { this.teams = t; this.loading = false; },
      error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar los equipos', 'error'); }
    });
  }

  create(): void {
    if (!this.newTeam.nameTeam) return;
    this.adminService.createTeam(this.newTeam).subscribe({
      next: () => { this.loadTeams(); this.newTeam = { activeTeam: true, assignmentMethod: 'ROUND_ROBIN' }; Swal.fire('Éxito', 'Equipo creado', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  edit(team: SupportTeam): void {
    this.editTeam = { ...team };
  }

  saveEdit(): void {
    if (!this.editTeam) return;
    this.adminService.updateTeam(this.editTeam.idTeam, this.editTeam).subscribe({
      next: () => { this.loadTeams(); this.editTeam = null; Swal.fire('Éxito', 'Equipo actualizado', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
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
          next: () => { this.loadTeams(); Swal.fire('Eliminado', '', 'success'); },
          error: (e) => Swal.fire('Error', e?.error?.message, 'error')
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
}
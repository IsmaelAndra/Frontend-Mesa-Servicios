import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, SlaEscalation, SupportTeam, SlaPolicy } from '../../../core/services/admin.service';

@Component({
  selector: 'app-escalation-management',
  templateUrl: './escalation-management.component.html'
})
export class EscalationManagementComponent implements OnInit {
  escalations: SlaEscalation[] = [];
  policies: SlaPolicy[] = [];
  teams: SupportTeam[] = [];
  loading = false;
  showNew = false;
  newEsc: Partial<SlaEscalation> = {};

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getEscalations().subscribe({ next: (e) => { this.escalations = e; this.loading = false; } });
    this.adminService.getSlaPolicies().subscribe({ next: (p) => this.policies = p });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
  }

  create(): void {
    if (!this.newEsc.slaPolicyId || !this.newEsc.triggerPercentage || !this.newEsc.actionType) return;
    this.adminService.createEscalation(this.newEsc).subscribe({
      next: () => { this.load(); this.newEsc = {}; this.showNew = false; Swal.fire('Éxito', 'Escalación creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  delete(e: SlaEscalation): void {
    Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteEscalation(e.idEscalation).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }

  getPolicyName(id: number): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.nameSlaPolicy || '—';
  }

  getTeamName(id: number): string {
    return this.teams.find(t => t.idTeam === id)?.nameTeam || '—';
  }
}
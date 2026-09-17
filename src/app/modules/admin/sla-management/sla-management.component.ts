import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, SlaPolicy, SlaRule, SlaEscalation } from '../../../core/services/admin.service';

@Component({
  selector: 'app-sla-management',
  templateUrl: './sla-management.component.html'
})
export class SlaManagementComponent implements OnInit {
  policies: SlaPolicy[] = [];
  rules: SlaRule[] = [];
  escalations: SlaEscalation[] = [];
  areas: any[] = [];
  priorities: any[] = [];
  categories: any[] = [];
  ticketTypes: any[] = [];
  teams: any[] = [];
  activeTab = 'policies';
  loading = false;
  showNewPolicy = false;
  showNewRule = false;
  showNewEscalation = false;
  newPolicy: Partial<SlaPolicy> = { activeSlaPolicy: true };
  newRule: Partial<SlaRule> = { activeSlaRule: true };
  newEscalation: Partial<SlaEscalation> = {};

  constructor(private adminService: AdminService) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getSlaPolicies().subscribe({ next: (p) => { this.policies = p; this.loading = false; } });
    this.adminService.getSlaRules().subscribe({ next: (r) => this.rules = r });
    this.adminService.getEscalations().subscribe({ next: (e) => this.escalations = e });
    this.adminService.getAreas().subscribe({ next: (a) => this.areas = a });
    this.adminService.getTicketTypes().subscribe({ next: (t) => this.ticketTypes = t });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
    // Get catalog for priorities/categories
    this.adminService.catalog().subscribe({ next: (c) => { this.priorities = c.priorities; this.categories = c.categories; } });
  }

  createPolicy(): void {
    if (!this.newPolicy.nameSlaPolicy || !this.newPolicy.responseTimeMinutes || !this.newPolicy.resolutionTimeMinutes) return;
    this.adminService.createSlaPolicy(this.newPolicy).subscribe({
      next: () => { this.load(); this.newPolicy = { activeSlaPolicy: true }; Swal.fire('Éxito', 'Política SLA creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  createRule(): void {
    if (!this.newRule.slaPolicyId || !this.newRule.areaId || !this.newRule.priorityId) return;
    this.adminService.createSlaRule(this.newRule).subscribe({
      next: () => { this.load(); this.newRule = { activeSlaRule: true }; Swal.fire('Éxito', 'Regla SLA creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  createEscalation(): void {
    if (!this.newEscalation.slaPolicyId || !this.newEscalation.triggerPercentage || !this.newEscalation.actionType) return;
    this.adminService.createEscalation(this.newEscalation).subscribe({
      next: () => { this.load(); this.newEscalation = {}; Swal.fire('Éxito', 'Escalación creada', 'success'); },
      error: (e) => Swal.fire('Error', e?.error?.message, 'error')
    });
  }

  deletePolicy(p: SlaPolicy): void {
    Swal.fire({ title: '¿Eliminar política?', text: p.nameSlaPolicy, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteSlaPolicy(p.idSlaPolicy).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }

  deleteRule(rule: SlaRule): void {
    Swal.fire({ title: '¿Eliminar regla?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((result) => { if (result.isConfirmed) this.adminService.deleteSlaRule(rule.idSlaRule).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }

  deleteEscalation(e: SlaEscalation): void {
    Swal.fire({ title: '¿Eliminar escalación?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteEscalation(e.idEscalation).subscribe({ next: () => this.load(), error: (e) => Swal.fire('Error', e?.error?.message, 'error') }); });
  }

  getPolicyName(id: number): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.nameSlaPolicy || '—';
  }

  getAreaName(id: number): string {
    return this.areas.find(a => a.idArea === id)?.nameArea || '—';
  }

  getPriorityName(id: number): string {
    return this.priorities.find(p => p.id === id)?.name || '—';
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || '—';
  }

  getTeamName(id: number): string {
    return this.teams.find(t => t.idTeam === id)?.nameTeam || '—';
  }
}
import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import { AdminService, NotificationTemplate, SlaPolicy, SlaRule, SlaEscalation, SupportTeam, TicketTypeConfig } from '../../../core/services/admin.service';
import { Area, Catalog } from '../../../models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { ACCIONES_ESCALACION, metaAccionEscalacion } from '../../../core/utils/sla-escalacion.util';
import { duracionLegible } from '../../../core/utils/duracion.util';

@Component({
  selector: 'app-sla-management',
  templateUrl: './sla-management.component.html'
})
export class SlaManagementComponent implements OnInit {
  /** Plazos en texto legible ("4 h", "2 d") en vez de minutos crudos. */
  readonly duracion = duracionLegible;
  policies: SlaPolicy[] = [];
  rules: SlaRule[] = [];
  escalations: SlaEscalation[] = [];

  /**
   * Las reglas son el crucé de área × prioridad × categoría, así que solo con la
   * semilla hay unas 140 filas. Sin paginar, la tabla empujaba el resto de la
   * pantalla muy por debajo del pliegue.
   */
  readonly pagRules = new Paginacion<SlaRule>(() => this.rules, 15);
  readonly pagEscalations = new Paginacion<SlaEscalation>(() => this.escalations, 10);

  areas: Area[] = [];
  priorities: Catalog['priorities'] = [];
  categories: Catalog['categories'] = [];
  ticketTypes: TicketTypeConfig[] = [];
  teams: SupportTeam[] = [];
  templates: NotificationTemplate[] = [];
  activeTab = 'policies';
  loading = false;
  showNewPolicy = false;
  showNewRule = false;
  showNewEscalation = false;
  newPolicy: Partial<SlaPolicy> = {
    activeSlaPolicy: true,
    iconSlaPolicy: 'fa-solid fa-clock',
    colorSlaPolicy: '#D97706'
  };
  newRule: Partial<SlaRule> = { activeSlaRule: true };
  newEscalation: Partial<SlaEscalation> = {};

  /**
   * Opciones de los selectores de reglas y escalaciones. Cada maestro trae
   * `icon_*` y `color_*`, así que las filas del desplegable los muestran.
   */
  areaOptions(): MasterOption[] {
    return (this.areas || []).map(a => ({
      value: a.idArea, label: a.nameArea, icon: a.iconArea, color: a.colorArea
    }));
  }

  priorityOptions(): MasterOption[] {
    return (this.priorities || []).map(p => ({
      value: p.id, label: p.name, icon: p.icon, color: p.color
    }));
  }

  categoryOptions(): MasterOption[] {
    return (this.categories || []).map(c => ({
      value: c.id, label: c.name, icon: c.icon, color: c.color
    }));
  }

  ticketTypeOptions(): MasterOption[] {
    return (this.ticketTypes || []).map(t => ({
      value: t.id, label: t.name, icon: t.icon, color: t.color
    }));
  }

  teamOptions(): MasterOption[] {
    return (this.teams || []).map(t => ({
      value: t.idTeam, label: t.nameTeam, icon: t.iconTeam, color: t.colorTeam
    }));
  }

  /** Políticas con su icono y color, para el select de reglas y escalaciones. */
  policyOptions(): MasterOption[] {
    return (this.policies || []).map(p => ({
      value: p.idSlaPolicy, label: p.nameSlaPolicy,
      icon: p.iconSlaPolicy || 'fa-solid fa-stopwatch', color: p.colorSlaPolicy || '#062e86'
    }));
  }

  templateOptions(): MasterOption[] {
    return (this.templates || []).map(t => ({
      value: t.idTemplate, label: t.nameTemplate,
      icon: t.iconTemplate || 'fa-regular fa-envelope', color: t.colorTemplate || '#64748B'
    }));
  }

  readonly accionOptions = ACCIONES_ESCALACION;

  metaAccion(valor?: string | null) {
    return metaAccionEscalacion(valor);
  }

  teamMeta(id: string): { icon: string; color: string } {
    const t = this.teams.find(x => x.idTeam === id);
    return { icon: t?.iconTeam || 'fa-solid fa-users', color: t?.colorTeam || '#64748B' };
  }

  /** Filas en modo edición (políticas, reglas y escalaciones). */
  editPolicy: Partial<SlaPolicy> | null = null;
  editRule: Partial<SlaRule> | null = null;
  editEscalation: Partial<SlaEscalation> | null = null;

  constructor(private adminService: AdminService, private toastService: ToastService) { }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getSlaPolicies().subscribe({ next: (p) => { this.policies = p; this.loading = false; } });
    this.adminService.getSlaRules().subscribe({ next: (r) => this.rules = r });
    this.adminService.getEscalations().subscribe({ next: (e) => this.escalations = e });
    this.adminService.getAreas().subscribe({ next: (a) => this.areas = a });
    this.adminService.getTicketTypes().subscribe({ next: (t) => this.ticketTypes = t });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
    this.adminService.getTemplates().subscribe({ next: (t) => this.templates = t });
    // Get catalog for priorities/categories
    this.adminService.catalog().subscribe({ next: (c) => { this.priorities = c.priorities; this.categories = c.categories; } });
  }

  createRule(): void {
    if (!this.newRule.slaPolicyId || !this.newRule.areaId || !this.newRule.priorityId) return;
    this.adminService.createSlaRule(this.newRule).subscribe({
      next: () => { this.load(); this.newRule = { activeSlaRule: true }; this.showNewRule = false; this.toastService.success('Regla SLA creada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  // ============================ REGLAS ============================

  startEditRule(r: SlaRule): void {
    this.editRule = { ...r };
  }

  saveEditRule(): void {
    const e = this.editRule;
    if (!e || !e.idSlaRule || !e.slaPolicyId || !e.areaId || !e.priorityId) return;
    this.adminService.updateSlaRule(e.idSlaRule, e).subscribe({
      next: () => { this.editRule = null; this.load(); this.toastService.success('Regla SLA actualizada'); },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar')
    });
  }

  cancelEditRule(): void {
    this.editRule = null;
  }

  /** Icono y color del área, para mostrarlos junto a la regla. */
  areaMeta(id: string): { icon: string; color: string } {
    const a = this.areas.find(x => x.idArea === id);
    return { icon: a?.iconArea || 'fa-solid fa-building', color: a?.colorArea || '#062e86' };
  }

  priorityMeta(id: string): { icon: string; color: string } {
    const p = this.priorities.find(x => x.id === id);
    return { icon: p?.icon || 'fa-solid fa-flag', color: p?.color || '#64748B' };
  }

  categoryMeta(id: string): { icon: string; color: string } {
    const c = this.categories.find(x => x.id === id);
    return { icon: c?.icon || 'fa-solid fa-tag', color: c?.color || '#64748B' };
  }

  typeMeta(id: string): { icon: string; color: string } {
    const t = this.ticketTypes.find(x => x.id === id);
    return { icon: t?.icon || 'fa-solid fa-tag', color: t?.color || '#64748B' };
  }

  // ============================ POLÍTICAS ============================

  policyIcon(p: Partial<SlaPolicy>): string {
    return p.iconSlaPolicy || 'fa-solid fa-clock';
  }

  policyColor(p: Partial<SlaPolicy>): string {
    return p.colorSlaPolicy || '#64748B';
  }

  createPolicy(): void {
    if (!this.newPolicy.nameSlaPolicy || !this.newPolicy.responseTimeMinutes || !this.newPolicy.resolutionTimeMinutes) return;
    this.adminService.createSlaPolicy(this.newPolicy).subscribe({
      next: () => { this.load(); this.newPolicy = { activeSlaPolicy: true, iconSlaPolicy: 'fa-solid fa-clock', colorSlaPolicy: '#D97706' }; this.showNewPolicy = false; this.toastService.success('Política SLA creada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  startEditPolicy(p: SlaPolicy): void {
    this.editPolicy = { ...p };
  }

  saveEditPolicy(): void {
    const e = this.editPolicy;
    if (!e || !e.idSlaPolicy) return;
    this.adminService.updateSlaPolicy(e.idSlaPolicy, e).subscribe({
      next: () => { this.editPolicy = null; this.load(); this.toastService.success('Política SLA actualizada'); },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar')
    });
  }

  cancelEditPolicy(): void {
    this.editPolicy = null;
  }

  deletePolicy(p: SlaPolicy): void {
    Swal.fire({ title: '¿Eliminar política?', html: `<b>${p.nameSlaPolicy}</b> quedará desactivada y sus tickets dejarán de usar su SLA.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteSlaPolicy(p.idSlaPolicy).subscribe({ next: () => this.load(), error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar') }); });
  }

  deleteRule(rule: SlaRule): void {
    Swal.fire({ title: '¿Eliminar regla?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((result) => { if (result.isConfirmed) this.adminService.deleteSlaRule(rule.idSlaRule).subscribe({ next: () => this.load(), error: (e) => this.toastService.error(e?.error?.message || 'No se pudo eliminar') }); });
  }

  // ============================ ESCALACIONES ============================

  createEscalation(): void {
    if (!this.newEscalation.slaPolicyId || !this.newEscalation.triggerPercentage || !this.newEscalation.actionType) return;
    this.adminService.createEscalation(this.newEscalation).subscribe({
      next: () => { this.load(); this.newEscalation = {}; this.showNewEscalation = false; this.toastService.success('Escalación creada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  startEditEscalation(e: SlaEscalation): void {
    this.editEscalation = { ...e };
  }

  saveEditEscalation(): void {
    const e = this.editEscalation;
    if (!e || !e.idEscalation) return;
    this.adminService.updateEscalation(e.idEscalation, e).subscribe({
      next: () => { this.editEscalation = null; this.load(); this.toastService.success('Escalación actualizada'); },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar')
    });
  }

  cancelEditEscalation(): void {
    this.editEscalation = null;
  }

  deleteEscalation(e: SlaEscalation): void {
    Swal.fire({ title: '¿Eliminar escalación?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteEscalation(e.idEscalation).subscribe({ next: () => this.load(), error: (err) => this.toastService.error(err?.error?.message || 'No se pudo eliminar') }); });
  }

  /** Nombre de la plantilla vinculada a una escalación. */
  templateName(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.nameTemplate || '—';
  }

  templateIcon(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.iconTemplate || 'fa-regular fa-envelope';
  }

  templateColor(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.colorTemplate || '#64748B';
  }

  /** Icono y color de la política, para mostrarlos junto a la regla. */
  policyMeta(id: string): { icon: string; color: string } {
    const p = this.policies.find(x => x.idSlaPolicy === id);
    return { icon: p?.iconSlaPolicy || 'fa-solid fa-shield-halved', color: p?.colorSlaPolicy || '#062e86' };
  }

  getPolicyName(id: string): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.nameSlaPolicy || '—';
  }

  getAreaName(id: string): string {
    return this.areas.find(a => a.idArea === id)?.nameArea || '—';
  }

  getPriorityName(id: string): string {
    return this.priorities.find(p => p.id === id)?.name || '—';
  }

  getCategoryName(id: string): string {
    return this.categories.find(c => c.id === id)?.name || '—';
  }

  getTeamName(id: string): string {
    return this.teams.find(t => t.idTeam === id)?.nameTeam || '—';
  }
}
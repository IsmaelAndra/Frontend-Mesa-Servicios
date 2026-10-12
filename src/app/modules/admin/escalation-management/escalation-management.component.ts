import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import {
  AdminService,
  NotificationTemplate,
  SlaEscalation,
  SlaPolicy,
  SupportTeam
} from '../../../core/services/admin.service';
import { Paginacion } from '../../../core/utils/pagination.util';
import { ToastService } from '../../../core/services/toast.service';
import { MasterOption } from '../../shared/components/master-select/master-select.component';

@Component({
  selector: 'app-escalation-management',
  templateUrl: './escalation-management.component.html'
})
export class EscalationManagementComponent implements OnInit {
  escalations: SlaEscalation[] = [];
  /** Paginacion en cliente: el endpoint devuelve la lista completa. */
  readonly pagEscalations = new Paginacion<SlaEscalation>(() => this.escalations);
  policies: SlaPolicy[] = [];
  teams: SupportTeam[] = [];
  templates: NotificationTemplate[] = [];
  loading = false;
  showNew = false;
  newEsc: Partial<SlaEscalation> = {};

  /** Escalación en modo edición. */
  editEsc: Partial<SlaEscalation> | null = null;

  constructor(private adminService: AdminService, private toastService: ToastService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminService.getEscalations().subscribe({ next: (e) => { this.escalations = e; this.loading = false; } });
    this.adminService.getSlaPolicies().subscribe({ next: (p) => this.policies = p });
    this.adminService.getTeams().subscribe({ next: (t) => this.teams = t });
    this.adminService.getTemplates().subscribe({ next: (t) => this.templates = t });
  }

  create(): void {
    if (!this.newEsc.slaPolicyId || !this.newEsc.triggerPercentage || !this.newEsc.actionType) return;
    this.adminService.createEscalation(this.newEsc).subscribe({
      next: () => { this.load(); this.newEsc = {}; this.showNew = false; this.toastService.success('Escalación creada'); },
      error: (e) => this.toastService.error(e?.error?.message || 'No se pudo crear')
    });
  }

  startEdit(e: SlaEscalation): void {
    this.editEsc = { ...e };
  }

  saveEdit(): void {
    const e = this.editEsc;
    if (!e || !e.idEscalation) return;
    this.adminService.updateEscalation(e.idEscalation, e).subscribe({
      next: () => { this.editEsc = null; this.load(); this.toastService.success('Escalación actualizada'); },
      error: (err) => this.toastService.error(err?.error?.message || 'No se pudo actualizar')
    });
  }

  cancelEdit(): void {
    this.editEsc = null;
  }

  delete(e: SlaEscalation): void {
    Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' })
      .then((r) => { if (r.isConfirmed) this.adminService.deleteEscalation(e.idEscalation).subscribe({ next: () => this.load(), error: (err) => this.toastService.error(err?.error?.message || 'No se pudo eliminar') }); });
  }

  /** Texto de la acción, el mismo que se elige en el formulario. */
  etiquetaAccion(accion: string): string {
    return ACCIONES[accion] ?? accion;
  }

  getPolicyName(id: string): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.nameSlaPolicy || '—';
  }

  policyIcon(id: string): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.iconSlaPolicy || 'fa-solid fa-shield-halved';
  }

  policyColor(id: string): string {
    return this.policies.find(p => p.idSlaPolicy === id)?.colorSlaPolicy || '#64748B';
  }

/** Opciones de equipo para app-master-select, con icono y color del maestro. */
  get teamOptions(): MasterOption[] {
    return this.teams.map(t => ({
      value: t.idTeam,
      label: t.nameTeam,
      icon: t.iconTeam,
      color: t.colorTeam
    }));
  }

  getTeamName(id: string): string {
    return this.teams.find(t => t.idTeam === id)?.nameTeam || '—';
  }

  teamIcon(id: string): string {
    return this.teams.find(t => t.idTeam === id)?.iconTeam || 'fa-solid fa-users';
  }

  teamColor(id: string): string {
    return this.teams.find(t => t.idTeam === id)?.colorTeam || '#64748B';
  }

  templateName(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.nameTemplate || 'Sin plantilla';
  }

  templateIcon(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.iconTemplate || 'fa-regular fa-envelope';
  }

  templateColor(id?: string | null): string {
    return this.templates.find(t => t.idTemplate === id)?.colorTemplate || '#64748B';
  }
}

const ACCIONES: Record<string, string> = {
  NOTIFY_SUPERVISOR: 'Notificar al supervisor',
  ESCALATE: 'Escalar',
  REASSIGN: 'Reasignar'
};

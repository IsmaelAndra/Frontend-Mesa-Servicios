import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [ngClass]="badgeClass">{{ status }}</span>`
})
export class StatusBadgeComponent {
  @Input() status = '';

  get badgeClass(): string {
    const map: Record<string, string> = {
      NUEVO: 'badge-info',
      ASIGNADO: 'badge-primary',
      EN_PROCESO: 'badge-warning',
      RESUELTO: 'badge-success',
      CERRADO: 'badge-ghost',
      REABIERTO: 'badge-error',
      ESCALADO: 'badge-secondary'
    };
    return map[this.status] || 'badge-neutral';
  }
}
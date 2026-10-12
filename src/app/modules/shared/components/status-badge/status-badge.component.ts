import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `
    <span
      class="badge gap-1"
      [ngClass]="badgeClass"
      [style.background-color]="background"
      [style.color]="color"
      [style.border-color]="color"
    >
      <i *ngIf="icon" [class]="icon" class="text-xs" aria-hidden="true"></i>
      {{ status }}
    </span>
  `
})
export class StatusBadgeComponent {
  @Input() status = '';
  @Input() icon = '';
  @Input() color = '';

  get badgeClass(): string {
    if (this.color) return 'border';
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

  get background(): string {
    return this.color ? this.color + '1F' : '';
  }
}

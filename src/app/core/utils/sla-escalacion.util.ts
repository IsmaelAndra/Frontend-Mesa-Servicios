import { MasterOption } from '../../modules/shared/components/master-select/master-select.component';

/**
 * Acciones de una escalación SLA, con icono y color para el select y para el
 * badge de la tabla. Lo usan Reglas SLA (sla-management) y Escalaciones
 * (escalation-management), que antes mostraban el código en inglés.
 */
export const ACCIONES_ESCALACION: MasterOption[] = [
  { value: 'NOTIFY_SUPERVISOR', label: 'Notificar al supervisor', icon: 'fa-regular fa-bell', color: '#D97706' },
  { value: 'ESCALATE', label: 'Escalar', icon: 'fa-solid fa-arrow-up', color: '#DC2626' },
  { value: 'REASSIGN', label: 'Reasignar', icon: 'fa-solid fa-arrow-right-arrow-left', color: '#2563EB' },
];

/** Icono, color y nombre en español de una acción de escalación. */
export function metaAccionEscalacion(valor?: string | null): { label: string; icon: string; color: string } {
  const a = ACCIONES_ESCALACION.find((x) => x.value === valor);
  return {
    label: a?.label ?? valor ?? '—',
    icon: a?.icon ?? 'fa-solid fa-bolt',
    color: a?.color ?? '#64748B',
  };
}

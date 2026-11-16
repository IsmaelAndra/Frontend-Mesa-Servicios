export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedUserId: string;
  assignedUserEmail: string;
  createdByUserId: string;
  createdByEmail: string;
  start?: string;
  due?: string;
  durationMinutes?: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Minutos antes del plazo en que se avisa por correo y campana; null = sin aviso. */
  recordatorioMinutos?: number | null;
}

export type TaskStatus = 'PENDIENTE' | 'EN_CURSO' | 'EN_REVISION' | 'HECHO';

export interface TaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  assignedUserId: string;
  start?: string;
  due?: string;
  durationMinutes?: number;
  color?: string;
  recordatorioMinutos?: number | null;
}

/** Opciones del aviso antes del plazo (minutos). */
export const RECORDATORIOS: { valor: number | null; texto: string }[] = [
  { valor: null, texto: 'Sin aviso' },
  { valor: 15, texto: '15 minutos antes' },
  { valor: 30, texto: '30 minutos antes' },
  { valor: 60, texto: '1 hora antes' },
  { valor: 120, texto: '2 horas antes' },
  { valor: 1440, texto: '1 día antes' },
  { valor: 2880, texto: '2 días antes' },
];

export const KANBAN_STATUSES: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'PENDIENTE', label: 'Pendiente', color: '#3B82F6' },
  { key: 'EN_CURSO', label: 'En curso', color: '#F59E0B' },
  { key: 'EN_REVISION', label: 'En revisión', color: '#8B5CF6' },
  { key: 'HECHO', label: 'Hecho', color: '#10B981' }
];

export interface CalendarEvent {
  id: string;
  type: 'TASK' | 'TICKET';
  title: string;
  start: string;
  end: string;
  status: string;
  color: string;
  refId: string;
  /** Número visible del ticket; null en las tareas. */
  refNumber?: number | null;
  allDay: boolean;
  /** Fecha de creación del recurso (tarea o ticket) */
  createdAt?: string;
}
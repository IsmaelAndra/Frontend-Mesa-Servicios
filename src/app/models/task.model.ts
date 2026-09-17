export interface TaskItem {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedUserId: number;
  assignedUserEmail: string;
  createdByUserId: number;
  createdByEmail: string;
  start?: string;
  due?: string;
  durationMinutes?: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskStatus = 'PENDIENTE' | 'EN_CURSO' | 'EN_REVISION' | 'HECHO';

export interface TaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  assignedUserId: number;
  start?: string;
  due?: string;
  durationMinutes?: number;
  color?: string;
}

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
  refId: number;
  allDay: boolean;
}
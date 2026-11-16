/** Proyectos (Fase 3). Ver ProyectoService en el backend. */

export type EstadoProyecto = 'PLANIFICADO' | 'EN_CURSO' | 'PAUSADO' | 'TERMINADO' | 'CANCELADO';
export type EstadoItem = 'POR_HACER' | 'EN_CURSO' | 'EN_REVISION' | 'HECHO';
export type EstadoSprint = 'PLANIFICADO' | 'ACTIVO' | 'CERRADO';

export interface ProyectoResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  areaId: string;
  area: string;
  estado: EstadoProyecto;
  icono: string | null;
  color: string | null;
  inicio: string | null;
  fin: string | null;
  /** 0–100, ponderado por el peso de las tarjetas HECHO. */
  avance: number;
  tarjetas: number;
  hechas: number;
  miembros: number;
  areasParticipantes: string[];
  gestionar: boolean;
  actualizado: string;
}

export interface ProyectoArea {
  areaId: string;
  nombre: string;
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';
  motivo: string | null;
  decididoAt: string | null;
}

export interface ProyectoMiembro {
  userId: string;
  nombre: string;
  correo: string | null;
  areaId: string | null;
  area: string | null;
  rol: 'RESPONSABLE' | 'MIEMBRO' | null;
}

export interface ProyectoSprint {
  id: string;
  nombre: string;
  objetivo: string | null;
  inicio: string | null;
  fin: string | null;
  estado: EstadoSprint;
  avance: number;
  tarjetas: number;
}

export interface ProyectoItem {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoItem;
  peso: number;
  responsableId: string | null;
  responsable: string | null;
  limite: string | null;
  orden: number;
  sprintId: string | null;
}

export interface ProyectoObjetivo {
  id: string;
  descripcion: string;
  logradoAt: string | null;
  notaLogro: string | null;
}

export interface ProyectoDetalle {
  proyecto: ProyectoResumen;
  areas: ProyectoArea[];
  miembros: ProyectoMiembro[];
  sprints: ProyectoSprint[];
  items: ProyectoItem[];
  objetivos: ProyectoObjetivo[];
  permisos: { gestionar: boolean; editarTablero: boolean; agregarMiembros: boolean };
}

export interface InvitacionProyecto {
  proyectoId: string;
  proyecto: string;
  descripcion: string | null;
  areaDuena: string;
  invitadoPor: string | null;
  fecha: string;
}

export interface ProyectoRequest {
  nombre: string;
  descripcion?: string | null;
  areaId?: string | null;
  estado?: EstadoProyecto;
  icono?: string | null;
  color?: string | null;
  inicio?: string | null;
  fin?: string | null;
}

export interface ItemRequest {
  titulo: string;
  descripcion?: string | null;
  estado?: EstadoItem;
  peso?: number;
  responsableId?: string | null;
  limite?: string | null;
  sprintId?: string | null;
}

export interface SprintRequest {
  nombre: string;
  objetivo?: string | null;
  inicio?: string | null;
  fin?: string | null;
  estado?: EstadoSprint;
}

/** Columnas del tablero, con su color. */
export const COLUMNAS_PROYECTO: { clave: EstadoItem; titulo: string; color: string; icono: string }[] = [
  { clave: 'POR_HACER', titulo: 'Por hacer', color: '#3B82F6', icono: 'fa-regular fa-circle' },
  { clave: 'EN_CURSO', titulo: 'En curso', color: '#F59E0B', icono: 'fa-solid fa-circle-half-stroke' },
  { clave: 'EN_REVISION', titulo: 'En revisión', color: '#8B5CF6', icono: 'fa-solid fa-magnifying-glass' },
  { clave: 'HECHO', titulo: 'Hecho', color: '#10B981', icono: 'fa-solid fa-circle-check' },
];

export const ESTADOS_PROYECTO: Record<EstadoProyecto, { texto: string; color: string; icono: string }> = {
  PLANIFICADO: { texto: 'Planificado', color: '#64748B', icono: 'fa-regular fa-calendar' },
  EN_CURSO: { texto: 'En curso', color: '#2563EB', icono: 'fa-solid fa-play' },
  PAUSADO: { texto: 'Pausado', color: '#D97706', icono: 'fa-solid fa-pause' },
  TERMINADO: { texto: 'Terminado', color: '#16A34A', icono: 'fa-solid fa-flag-checkered' },
  CANCELADO: { texto: 'Cancelado', color: '#DC2626', icono: 'fa-solid fa-ban' },
};

export const ESTADOS_SPRINT: Record<EstadoSprint, { texto: string; color: string; icono: string }> = {
  PLANIFICADO: { texto: 'Planificado', color: '#64748B', icono: 'fa-regular fa-calendar' },
  ACTIVO: { texto: 'Activo', color: '#2563EB', icono: 'fa-solid fa-play' },
  CERRADO: { texto: 'Cerrado', color: '#16A34A', icono: 'fa-solid fa-lock' },
};

/** Archivo de un mensaje del chat de proyecto (V39). */
export interface AdjuntoMensaje {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
}

/** Mensaje del chat grupal de un proyecto. `propio` lo recalcula el cliente con autorId. */
export interface MensajeProyecto {
  id: string;
  proyectoId: string;
  autorId: string;
  autor: string;
  autorFoto: string | null;
  texto: string | null;
  creado: string;
  propio: boolean;
  adjuntos: AdjuntoMensaje[];
}

/** Persona que se puede mencionar con @ en el chat del proyecto. */
export interface ParticipanteChat {
  id: string;
  nombre: string;
  foto: string | null;
}

/** Lo que admite el chat (igual que los adjuntos de tickets). */
export const ACCEPT_CHAT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

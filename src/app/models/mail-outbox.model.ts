/** Estados de un correo en la cola (V10__cola_de_correo.sql). */
export type EstadoCorreo = 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'AGRUPADO' | 'FALLIDO' | 'CANCELADO';

export interface CorreoEnCola {
  id: string;
  to: string;
  subject: string;
  type: string | null;
  priority: number;
  status: EstadoCorreo;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  nextAttemptAt: string | null;
  sentAt: string | null;
}

export interface PuntoHora {
  hora: string;
  enviados: number;
  agrupados: number;
  fallidos: number;
  pendientes: number;
}

export interface ResumenColaCorreo {
  envioHabilitado: boolean;
  remitente: string | null;
  limitePorMinuto: number;
  enviadosUltimoMinuto: number;
  pausadoHasta: string | null;
  pendientes: number;
  enviando: number;
  fallidos: number;
  enviadosHoy: number;
  agrupadosHoy: number;
  fallidosHoy: number;
  segundosPendienteMasAntiguo: number | null;
  minutosParaVaciar: number;
  porHora: PuntoHora[];
  porTipo: { tipo: string; total: number }[];
}

export interface PaginaCorreos {
  content: CorreoEnCola[];
  totalElements: number;
  number: number;
  size: number;
}

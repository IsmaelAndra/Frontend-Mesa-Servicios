/**
 * El grafo de un workflow, tal y como viaja al servidor.
 *
 * <p>Los nombres de estas propiedades <b>no se inventan aquí</b>: son el contrato
 * que espera `WorkflowGraphDef` en Java. Si uno cambia, el servidor deja de
 * reconocerlo y el error que sale es "El grafo no tiene nodos", que no señala el
 * campo. Por eso van sin renombrar y sin "limpiar".
 */
export interface WorkflowGraph {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** IF: "SI"/"NO". APPROVAL: "APROBADO"/"RECHAZADO"/"VENCIDO". SWITCH: la salida del caso. Resto: "NEXT". */
  sourcePort: string;
  label?: string | null;
}

/**
 * Los tipos de nodo que el motor sabe ejecutar.
 *
 * <p>La lista es cerrada en el servidor: lo que no esté aquí se rechaza al
 * guardar. Por eso no hay un "otro" que adivine.
 */
export type WorkflowNodeType =
  | 'INICIO'
  | 'FIN'
  | 'IF'
  | 'SWITCH'
  | 'WAIT'
  | 'APPROVAL'
  | 'NOTIFY'
  | 'EMAIL'
  | 'TICKET_ASSIGN'
  | 'TICKET_STATUS'
  | 'TICKET_COMMENT'
  | 'TICKET_PRIORITY'
  | 'TICKET_CATEGORY'
  | 'TICKET_TYPE'
  | 'TICKET_CLOSE'
  | 'TICKET_REOPEN'
  | 'TICKET_ASSIGN_TEAM'
  | 'TICKET_CREATE'
  | 'TASK_CREATE'
  | 'SLA_APPLY'
  | 'NEXA'
  | 'AUDIT';

/** Lo que el constructor ofrece en la paleta. */
export interface NodePaletteEntry {
  type: WorkflowNodeType;
  label: string;
  description: string;
  /** Color de la caja, para distinguir de un vistazo. */
  color: string;
  group: 'control' | 'decision' | 'ticket' | 'comunicacion' | 'otros';
  /** Si el nodo necesita configuración para servir de algo. */
  configurable: boolean;
  /** Puertos de salida que dibuja el constructor. */
  ports: string[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  status: 'BORRADOR' | 'ACTIVO' | 'INACTIVO' | 'ERROR';
  triggerType: string;
  currentVersion: number;
  active: boolean;
  runCount: number;
  authorityScope: string;
  createdAt: string;
  updatedAt: string;
  lastRun?: string | null;
  /** Solo en los programados. */
  nextRunAt?: string | null;
}

export interface WorkflowVersion {
  id: string;
  version: number;
  definition: string;
  current: boolean;
  publishedBy: number | null;
  publishedAt: string | null;
  createdAt: string | null;
}

export interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  triggerConfig: string | null;
  currentVersion: number;
  active: boolean;
  runCount: number;
  authorityScope: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  versions: WorkflowVersion[];
}

/** Estados de una ejecución. Coinciden con `WorkflowExecution` en Java. */
export type ExecutionStatus =
  | 'PENDIENTE'
  | 'EJECUTANDO'
  | 'ESPERANDO'
  | 'APROBACION'
  | 'COMPLETADO'
  | 'ERROR'
  | 'CANCELADO';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  versionId: string;
  triggerType: string;
  correlationKey: string | null;
  status: ExecutionStatus;
  currentNode: string | null;
  depth: number;
  attempts: number;
  errorNode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  durationMs?: number | null;
  /** Número de versión (v1, v2...). */
  versionNumber?: number | null;
  startedById?: string | null;
  startedByName?: string | null;
  /** TICKET o USUARIO, con su id. */
  entityType?: string | null;
  entityId?: string | null;
  originExecutionId?: string | null;
  /** Cómo se lee la entidad: "#43" o el nombre del usuario. */
  entityLabel?: string | null;
  /** JSON con el motivo del último estado. */
  result?: string | null;
}

export interface WorkflowNodeRun {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  sequence: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** JSON: nombre y configuración con la que corrió el nodo. */
  input?: string | null;
  /** JSON: variables que el nodo creó o cambió. */
  output?: string | null;
}

/** Lo que devuelve el backend al validar un grafo sin guardarlo. */
export interface GraphValidation {
  valid: boolean;
  errors: string[];
}
/** Catálogo del motor (GET /admin/workflows/catalogo). */
export interface WorkflowCatalog {
  disparadores: {
    tipo: string;
    descripcion: string;
    entidad: 'TICKET' | 'USUARIO' | 'NINGUNA';
    /** variable -> descripción */
    variables: Record<string, string>;
  }[];
  nodos: { tipo: string; puertos: string[]; salidas: Record<string, string> }[];
  operadores: string[];
}

/** Configuración del disparador programado. */
export interface ScheduleConfig {
  modo: 'INTERVALO' | 'CRON' | 'FECHA';
  minutos?: number;
  cron?: string;
  fecha?: string;
}

/** Aprobación pendiente en la bandeja. */
export interface WorkflowApproval {
  id: string;
  executionId: string;
  workflowName: string | null;
  nodeId: string;
  solicitud: string | null;
  requiredRole: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  createdAt: string;
  deadline: string | null;
  /** PENDING, APPROVED, REJECTED o TIMEOUT. */
  status?: string;
  /** Correo de quien provocó la solicitud. */
  requestedBy?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  comment?: string | null;
}

/** Paso de una ejecución que llega por SSE mientras ocurre (evento "workflow"). */
export interface WorkflowPasoEvento {
  executionId: string;
  workflowId: string;
  /** NODO_INICIO, NODO_FIN o FIN (cierre de la vuelta). */
  tipo: 'NODO_INICIO' | 'NODO_FIN' | 'FIN';
  nodeId: string | null;
  nodeType: string | null;
  secuencia: number | null;
  /** En nodos: EJECUTANDO / COMPLETADO / ERROR. En FIN: el estado de la ejecución. */
  estado: string;
  puerto: string | null;
  siguiente: string | null;
  motivo: string | null;
  salida: Record<string, unknown> | null;
  duracionMs: number | null;
  at: string;
}

/** Un paso listo para animar, venga del SSE o del historial. */
export interface PasoAnimable {
  secuencia: number;
  nodeId: string;
  nodeType: string;
  /** EJECUTANDO mientras corre; COMPLETADO o ERROR al terminar. */
  estado: string;
  puerto: string | null;
  motivo: string | null;
  salida: Record<string, unknown> | null;
  duracionMs: number | null;
}

/** Cómo terminó la vuelta: completada, con error o en pausa. */
export interface FinAnimable {
  estado: string;
  motivo: string | null;
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExecutionStatus,
  GraphValidation,
  WorkflowDetail,
  WorkflowExecution,
  WorkflowGraph,
  WorkflowNodeRun,
  WorkflowSummary,
  WorkflowVersion,
  WorkflowCatalog,
  WorkflowApproval,
} from '../../models/workflow.model';

export interface WorkflowCreateRequest {
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: string | null;
}

export interface WorkflowExecutionPage {
  content: WorkflowExecution[];
  /** Spring Page devuelve totalElements; no existe "total". */
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

/**
 * Llamadas al motor de workflows.
 *
 * <p>Solo para `SUPER_ADMIN`: el servidor lo exige con un `@PreAuthorize` en el
 * controlador. Que la interfaz oculte el botón no es la protección, la da el
 * servidor; esta capa solo evita el viaje en balde.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly base = `${environment.apiUrl}/admin/workflows`;

  constructor(private http: HttpClient) {}

  listar(): Observable<WorkflowSummary[]> {
    return this.http.get<WorkflowSummary[]>(this.base);
  }

  detalle(id: string): Observable<WorkflowDetail> {
    return this.http.get<WorkflowDetail>(`${this.base}/${id}`);
  }

  crear(request: WorkflowCreateRequest): Observable<WorkflowSummary> {
    return this.http.post<WorkflowSummary>(this.base, request);
  }

  /** Publica una versión nueva. El servidor valida el grafo antes de guardar. */
  publicarVersion(id: string, grafo: WorkflowGraph): Observable<WorkflowVersion> {
    return this.http.post<WorkflowVersion>(`${this.base}/${id}/versions`, grafo);
  }

  activar(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/activate`, {});
  }

  desactivar(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/deactivate`, {});
  }

  borrar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Valida un grafo sin guardarlo.
   *
   * <p>Existe para avisar antes de publicar. Publicar un grafo roto sí falla, y con
   * el mismo detalle, pero después de haber escrito la versión.
   */
  validar(id: string, grafo: WorkflowGraph): Observable<GraphValidation> {
    return this.http.post<GraphValidation>(`${this.base}/${id}/validate`, grafo);
  }

  // ============================ Ejecuciones ============================

  ejecuciones(
    workflowId: string,
    estado: ExecutionStatus | null,
    pagina: number,
    tamano: number
  ): Observable<WorkflowExecutionPage> {
    let params = new HttpParams()
      .set('pagina', pagina)
      .set('tamano', tamano);
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<WorkflowExecutionPage>(`${this.base}/${workflowId}/ejecuciones`, {
      params,
    });
  }

  ejecucionDetalle(ejecucionId: string): Observable<WorkflowExecution> {
    return this.http.get<WorkflowExecution>(`${this.base}/ejecuciones/${ejecucionId}`);
  }

  /** Los pasos de una ejecución, en el orden en que se recorrieron. */
  pasos(ejecucionId: string): Observable<WorkflowNodeRun[]> {
    return this.http.get<WorkflowNodeRun[]>(`${this.base}/ejecuciones/${ejecucionId}/pasos`);
  }

  cancelarEjecucion(ejecucionId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/ejecuciones/${ejecucionId}/cancelar`, {});
  }

  /** Lanza una ejecución a mano, para probar un proceso sin esperar un evento. */
  ejecutarAhora(id: string, payload: Record<string, unknown>): Observable<WorkflowExecution> {
    return this.http.post<WorkflowExecution>(`${this.base}/${id}/ejecutar`, payload);
  }

  // ============================ Fase 2 ============================

  /** Disparadores, nodos, variables y operadores que el motor conoce. */
  catalogo(): Observable<WorkflowCatalog> {
    return this.http.get<WorkflowCatalog>(`${this.base}/catalogo`);
  }

  /** Nombre, descripción y disparador. El grafo va por versiones. */
  actualizar(id: string, request: WorkflowCreateRequest): Observable<WorkflowSummary> {
    return this.http.put<WorkflowSummary>(`${this.base}/${id}`, request);
  }

  /** Historial de todos los workflows, con filtros opcionales. */
  todasLasEjecuciones(filtro: {
    workflowId?: string | null;
    estado?: ExecutionStatus | null;
    entidadTipo?: string | null;
    entidadId?: string | null;
  }, pagina: number, tamano: number): Observable<WorkflowExecutionPage> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (filtro.workflowId) params = params.set('workflowId', filtro.workflowId);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.entidadTipo) params = params.set('entidadTipo', filtro.entidadTipo);
    if (filtro.entidadId) params = params.set('entidadId', filtro.entidadId);
    return this.http.get<WorkflowExecutionPage>(`${this.base}/ejecuciones`, { params });
  }

  // ============================ Aprobaciones ============================
  // Fuera de /admin: quien aprueba puede ser un AGENT o un USER.

  aprobacionesPendientes(): Observable<WorkflowApproval[]> {
    return this.http.get<WorkflowApproval[]>(`${environment.apiUrl}/workflows/aprobaciones`);
  }

  contadorAprobaciones(): Observable<{ pendientes: number }> {
    return this.http.get<{ pendientes: number }>(`${environment.apiUrl}/workflows/aprobaciones/contador`);
  }

  decidirAprobacion(id: string, aprobar: boolean, comentario: string | null): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/workflows/aprobaciones/${id}/decidir`, {
      aprobar,
      comentario,
    });
  }
}

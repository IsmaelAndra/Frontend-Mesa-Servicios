import { InjectionToken, Signal, WritableSignal } from "@angular/core";
import { AgentOption } from "../../../core/services/admin.service";
import { Catalog } from "../../../models/user.model";
import { WorkflowCatalog, WorkflowGraph, WorkflowNode } from "../../../models/workflow.model";

/**
 * Lo que el panel de propiedades necesita del constructor de workflows.
 *
 * <p>Es una interfaz con su token y no la clase del constructor para que el panel
 * no importe el constructor (que a su vez importa el panel): con la importación
 * circular, uno de los dos llegaba sin definir al decorador.
 */
export interface EditorDeWorkflow {
  readonly grafo: Signal<WorkflowGraph>;
  readonly nodoSeleccionado: WritableSignal<string | null>;
  readonly nodoActual: Signal<WorkflowNode | null>;
  readonly catalogo: Signal<WorkflowCatalog | null>;
  readonly lookups: Signal<Catalog | null>;
  readonly agentes: Signal<AgentOption[]>;
  readonly disparadorActual: Signal<WorkflowCatalog["disparadores"][number] | null>;
  readonly erroresPorNodo: Signal<Map<string, string[]>>;
  readonly iconos: Record<string, string>;
  colorDe(tipo: string): string;
  etiquetaTipo(tipo: string): string;
  puertosDe(nodo: WorkflowNode): string[];
  destinoDe(nodo: WorkflowNode, puerto: string): string;
  casosDe(nodo: WorkflowNode | null): { valor: string; salida: string }[];
  renombrarNodo(id: string, nombre: string): void;
  duplicarNodo(id: string): void;
  eliminarNodo(id: string): void;
  conectarDesdeLista(nodo: WorkflowNode, puerto: string, destinoId: string): void;
  cambiarGrafo(fn: (g: WorkflowGraph) => WorkflowGraph): void;
}

export const EDITOR_DE_WORKFLOW = new InjectionToken<EditorDeWorkflow>("EditorDeWorkflow");

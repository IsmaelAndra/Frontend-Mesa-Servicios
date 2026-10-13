import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { WorkflowNode } from "../../../models/workflow.model";
import { EDITOR_DE_WORKFLOW } from "../workflow-builder/editor-de-workflow";
import { SharedModule } from "../../shared/shared.module";
import { MasterOption } from "../../shared/components/master-select/master-select.component";
import { environment } from "../../../../environments/environment";

/** Nombre e icono de cada operador de las condiciones. */
const NOMBRES_OPERADOR: Record<string, string> = {
  "==": "Igual a", "!=": "Distinto de", ">": "Mayor que", "<": "Menor que", ">=": "Mayor o igual",
  "<=": "Menor o igual", contiene: "Contiene", empieza_con: "Empieza con", termina_con: "Termina con",
  vacio: "Está vacío", no_vacio: "No está vacío", es_verdadero: "Es verdadero", es_falso: "Es falso",
};
const ICONOS_OPERADOR: Record<string, string> = {
  "==": "fa-solid fa-equals", "!=": "fa-solid fa-not-equal", ">": "fa-solid fa-greater-than",
  "<": "fa-solid fa-less-than", ">=": "fa-solid fa-greater-than-equal", "<=": "fa-solid fa-less-than-equal",
  contiene: "fa-solid fa-magnifying-glass", empieza_con: "fa-solid fa-backward-step",
  termina_con: "fa-solid fa-forward-step", vacio: "fa-regular fa-square", no_vacio: "fa-solid fa-square",
  es_verdadero: "fa-solid fa-circle-check", es_falso: "fa-solid fa-circle-xmark",
};

/** Maestro del catálogo con su icono y color, para app-master-select. */
function opcion(x: { id: string; name: string; icon?: string; color?: string }): MasterOption {
  return { value: x.id, label: x.name, icon: x.icon || undefined, color: x.color || undefined };
}

/**
 * Panel de propiedades del nodo seleccionado en el constructor de workflows.
 *
 * <p>Estaba dentro de la plantilla del constructor (más de mil líneas de un
 * total de 1.700). Aquí vive lo que solo usa el panel: la edición de la
 * configuración, el selector de variables y los casos del SWITCH. El grafo
 * sigue siendo del constructor, que es su única fuente de verdad: el panel lo
 * lee y lo cambia a través de {@link EDITOR_DE_WORKFLOW}.
 */
@Component({
  selector: "app-workflow-node-panel",
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: "./workflow-node-panel.component.html",
})
export class WorkflowNodePanelComponent {
  /** El constructor (lo provee él mismo con useExisting). */
  readonly editor = inject(EDITOR_DE_WORKFLOW);

  /** Campo de texto al que se insertará la variable elegida. */
  readonly campoVariable = signal<string | null>(null);
  readonly placeholderTicketId = "{{nodos.ticket_create_1.ticketId}}";
  readonly roles = ["SUPER_ADMIN", "ADMIN", "AGENT", "USER"];

  /** Opciones de los maestros con icono y color (mismo select que el resto de pantallas). */
  readonly opcCategorias = computed(() => (this.editor.lookups()?.categories ?? []).map(opcion));
  readonly opcPrioridades = computed(() => (this.editor.lookups()?.priorities ?? []).map(opcion));
  readonly opcTipos = computed(() => (this.editor.lookups()?.ticketTypes ?? []).map(opcion));
  readonly opcEquipos = computed(() => (this.editor.lookups()?.teams ?? []).map(opcion));
  readonly opcEstados = computed(() => (this.editor.lookups()?.statuses ?? []).map(opcion));
  readonly opcPoliticas = computed(() => (this.editor.lookups()?.slaPolicies ?? []).map(opcion));
  readonly opcAgentes = computed<MasterOption[]>(() =>
    this.editor.agentes().map((a) => ({
      value: a.idUser,
      label: a.displayName || a.corporateEmailUser,
      detail: a.corporateEmailUser,
      avatar: a.photoUrl ? (/^https?:\/\//i.test(a.photoUrl) ? a.photoUrl : environment.apiUrl + a.photoUrl) : null,
      initials: (a.displayName || a.corporateEmailUser || "?").charAt(0).toUpperCase(),
      sessionState: a.sessionState,
    })),
  );

  /** Operadores de la condición, con un icono que se lee de un vistazo. */
  readonly opcOperadores = computed<MasterOption[]>(() =>
    (this.editor.catalogo()?.operadores ?? []).map((op) => ({
      value: op,
      label: NOMBRES_OPERADOR[op] ? `${NOMBRES_OPERADOR[op]} (${op})` : op,
      icon: ICONOS_OPERADOR[op] ?? "fa-solid fa-equals",
      color: "#2563EB",
    })),
  );

  readonly accionesNexa: MasterOption[] = [
    { value: "CLASIFICAR", label: "Clasificar (prioridad, categoría, equipo)", icon: "fa-solid fa-tags", color: "#7C3AED" },
    { value: "RESUMIR", label: "Resumir el ticket", icon: "fa-solid fa-align-left", color: "#0E7490" },
    { value: "RESPONDER", label: "Proponer respuesta", icon: "fa-solid fa-reply", color: "#0D9488" },
  ];

  readonly destinosAviso: MasterOption[] = [
    { value: "AGENTE", label: "Agente asignado", icon: "fa-solid fa-headset", color: "#0E7490" },
    { value: "SOLICITANTE", label: "Solicitante", icon: "fa-regular fa-user", color: "#2563EB" },
  ];

  readonly opcRoles: MasterOption[] = [
    { value: "SUPER_ADMIN", label: "Super administrador", icon: "fa-solid fa-crown", color: "#7C3AED" },
    { value: "ADMIN", label: "Administrador", icon: "fa-solid fa-user-shield", color: "#2563EB" },
    { value: "AGENT", label: "Agente", icon: "fa-solid fa-headset", color: "#0E7490" },
    { value: "USER", label: "Usuario", icon: "fa-regular fa-user", color: "#64748B" },
  ];

  /** Nodos a los que puede ir un puerto (todos menos él mismo y el Inicio), con su icono y color. */
  private destinosCache: { grafo: unknown; porNodo: Map<string, MasterOption[]> } = { grafo: null, porNodo: new Map() };
  destinosPara(nodoId: string): MasterOption[] {
    const grafo = this.editor.grafo();
    if (this.destinosCache.grafo !== grafo) {
      this.destinosCache = { grafo, porNodo: new Map() };
    }
    let lista = this.destinosCache.porNodo.get(nodoId);
    if (!lista) {
      lista = grafo.nodes
        .filter((d) => d.id !== nodoId && d.type !== "INICIO")
        .map((d) => ({
          value: d.id,
          label: d.name,
          detail: this.editor.etiquetaTipo(d.type),
          icon: this.editor.iconos[d.type] ?? "fa-solid fa-circle",
          color: this.editor.colorDe(d.type),
        }));
      this.destinosCache.porNodo.set(nodoId, lista);
    }
    return lista;
  }

  /** Variables que ofrece el selector: las del disparador y las que dejan los demás nodos. */
  readonly variables = computed(() => {
    const lista: { clave: string; descripcion: string; grupo: string }[] = [];
    const disp = this.editor.disparadorActual();
    if (disp) {
      Object.entries(disp.variables).forEach(([clave, descripcion]) =>
        lista.push({ clave, descripcion, grupo: clave.split(".")[0] }),
      );
    }
    const actual = this.editor.nodoSeleccionado();
    const salidas = new Map(
      (this.editor.catalogo()?.nodos ?? []).map((n) => [n.tipo, n.salidas]),
    );
    for (const n of this.editor.grafo().nodes) {
      if (n.id === actual) continue;
      Object.entries(salidas.get(n.type) ?? {}).forEach(
        ([clave, descripcion]) =>
          lista.push({
            clave: `nodos.${n.id}.${clave}`,
            descripcion: `${n.name}: ${descripcion}`,
            grupo: "nodos",
          }),
      );
    }
    return lista;
  });

  setConfig(clave: string, valor: unknown): void {
    const id = this.editor.nodoSeleccionado();
    if (!id) return;
    this.editor.cambiarGrafo((g) => ({
      ...g,
      nodes: g.nodes.map((n) => {
        if (n.id !== id) return n;
        const config = { ...n.config };
        if (valor === "" || valor === null || valor === undefined) {
          delete config[clave];
        } else {
          config[clave] = valor;
        }
        return { ...n, config };
      }),
    }));
  }

  configDe(clave: string): string {
    const v = this.editor.nodoActual()?.config?.[clave];
    return v === undefined || v === null ? "" : String(v);
  }

  /** Inserta {{variable}} al final del campo elegido. */
  insertarVariable(variable: string): void {
    const campo = this.campoVariable();
    if (!campo) return;
    const actual = this.configDe(campo);
    const marcador = `{{${variable}}}`;
    // En campos de id o de comparación, la variable sustituye; en textos se añade.
    const reemplaza = [
      "campo",
      "equipoId",
      "prioridadId",
      "categoriaId",
      "agenteId",
      "ticketId",
      "usuarioId",
      "hasta",
      "para",
      "correo",
    ].includes(campo);
    if (campo === "campo") {
      this.setConfig("campo", variable);
    } else {
      this.setConfig(
        campo,
        reemplaza ? marcador : `${actual}${actual ? " " : ""}${marcador}`,
      );
    }
    this.campoVariable.set(null);
  }

  agregarCaso(): void {
    const n = this.editor.casosDe(this.editor.nodoActual()).length + 1;
    this.setConfig("casos", [
      ...this.editor.casosDe(this.editor.nodoActual()),
      { valor: "", salida: `CASO_${n}` },
    ]);
  }

  actualizarCaso(
    indice: number,
    campo: "valor" | "salida",
    texto: string,
  ): void {
    const casos = this.editor.casosDe(this.editor.nodoActual()).map((c) => ({ ...c }));
    if (!casos[indice]) return;
    casos[indice][campo] =
      campo === "salida"
        ? texto.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
        : texto;
    this.setConfig("casos", casos);
  }

  quitarCaso(indice: number): void {
    this.setConfig(
      "casos",
      this.editor.casosDe(this.editor.nodoActual()).filter((_, i) => i !== indice),
    );
  }

  /** Si el disparador no trae ticket, los nodos de ticket tienen que indicar cuál. */
  necesitaTicketId(nodo: WorkflowNode): boolean {
    const conTicket = [
      "TICKET_ASSIGN",
      "TICKET_ASSIGN_TEAM",
      "TICKET_STATUS",
      "TICKET_COMMENT",
      "TICKET_PRIORITY",
      "TICKET_CATEGORY",
      "TICKET_CLOSE",
      "TICKET_REOPEN",
      "SLA_APPLY",
      "NEXA",
    ];
    const entidad = this.editor.disparadorActual()?.entidad;
    return conTicket.includes(nodo.type) && !!entidad && entidad !== "TICKET";
  }
}

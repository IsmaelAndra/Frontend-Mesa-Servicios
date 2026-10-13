import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { WorkflowNode } from "../../../models/workflow.model";
import { EDITOR_DE_WORKFLOW } from "../workflow-builder/editor-de-workflow";
import { SharedModule } from "../../shared/shared.module";
import { MasterOption } from "../../shared/components/master-select/master-select.component";
import { environment } from "../../../../environments/environment";

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

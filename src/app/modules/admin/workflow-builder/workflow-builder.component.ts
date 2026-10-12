import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  forwardRef,
  computed,
  signal,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { WorkflowService } from "../../../core/services/workflow.service";
import {
  AdminService,
  AgentOption,
} from "../../../core/services/admin.service";
import { ToastService } from "../../../core/services/toast.service";
import { WorkflowEnVivoService } from "../../../core/services/workflow-en-vivo.service";
import { WorkflowNodePanelComponent } from "../workflow-node-panel/workflow-node-panel.component";
import { EDITOR_DE_WORKFLOW, EditorDeWorkflow } from "./editor-de-workflow";
import { WorkflowRunCanvasComponent } from "../workflow-run-canvas/workflow-run-canvas.component";
import { Subscription } from "rxjs";
import { Catalog } from "../../../models/user.model";
import {
  FinAnimable,
  GraphValidation,
  PasoAnimable,
  NodePaletteEntry,
  ScheduleConfig,
  WorkflowCatalog,
  WorkflowDetail,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeType,
} from "../../../models/workflow.model";
import Swal from "sweetalert2";

/** Una línea ya calculada para dibujar. */
interface Arista {
  edge: WorkflowEdge;
  path: string;
  etiqueta: string | null;
  lx: number;
  ly: number;
  /** Color del nodo de origen: el conector hereda el color de su proceso. */
  color: string;
}

/**
 * Constructor visual de un workflow.
 *
 * <p>Lienzo propio con SVG para las líneas y cajas posicionadas en absoluto. Se
 * descartó una librería de diagramado: las que hay pesan mucho para lo que se
 * necesita (cajas, conectores con puerto, zoom) y su modelo obligaría a traducir
 * del JSON del servidor, que es la parte que tiene que ser exacta.
 *
 * <p>El arrastre es manual (eventos de puntero) y no de CDK: con zoom, CDK mueve
 * la caja en píxeles de pantalla dentro de un lienzo escalado y la caja se
 * desplaza más rápido que el ratón. Aquí el desplazamiento se divide por el zoom.
 *
 * <p><b>El estado vive en signals</b>: el arrastre redibuja en cada movimiento y
 * con signals solo se recalcula lo que cambia.
 */
@Component({
  selector: "app-workflow-builder",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    WorkflowRunCanvasComponent,
    WorkflowNodePanelComponent,
  ],
  templateUrl: "./workflow-builder.component.html",
  // El panel de propiedades recibe el constructor por este token (ver editor-de-workflow.ts).
  providers: [{ provide: EDITOR_DE_WORKFLOW, useExisting: forwardRef(() => WorkflowBuilderComponent) }],
})
export class WorkflowBuilderComponent implements OnInit, OnDestroy, EditorDeWorkflow {
  @ViewChild("lienzo") lienzo?: ElementRef<HTMLDivElement>;

  /** El grafo que se está editando. Es la única fuente de verdad del lienzo. */
  readonly grafo = signal<WorkflowGraph>({
    name: "",
    nodes: [],
    edges: [],
    variables: {},
  });

  readonly workflow = signal<WorkflowDetail | null>(null);
  readonly workflowId = signal<string | null>(null);
  readonly nodoSeleccionado = signal<string | null>(null);
  readonly errores = signal<string[]>([]);
  readonly guardando = signal(false);
  readonly cargando = signal(true);
  readonly cambiosSinPublicar = signal(false);

  readonly catalogo = signal<WorkflowCatalog | null>(null);
  readonly lookups = signal<Catalog | null>(null);
  readonly agentes = signal<AgentOption[]>([]);

  readonly zoom = signal(1);
  readonly mostrarAjustes = signal(false);

  readonly TAMANO_LIENZO = 3000;
  readonly ANCHO_NODO = 210;
  readonly ALTO_NODO = 86;
  private readonly REJILLA = 10;

  /** Arrastre de una caja en curso. */
  private arrastre: {
    id: string;
    px: number;
    py: number;
    nx: number;
    ny: number;
  } | null = null;
  /** Conexión que se está dibujando desde un puerto. */
  readonly conexion = signal<{
    origen: string;
    puerto: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  /** Desplazamiento del lienzo con el ratón sobre el fondo. */
  private paneo: { x: number; y: number; sl: number; st: number } | null = null;

  ajustes: {
    name: string;
    description: string;
    triggerType: string;
    programacion: ScheduleConfig;
  } = {
    name: "",
    description: "",
    triggerType: "TICKET_CREATED",
    programacion: { modo: "INTERVALO", minutos: 60 },
  };

  /**
   * Paleta. La lista que manda es la del servidor (catálogo): un tipo que el
   * motor no conozca no se ofrece aunque esté aquí. Esto solo es presentación.
   */
  readonly paleta: NodePaletteEntry[] = [
    {
      type: "INICIO",
      label: "Inicio",
      description: "Punto de partida. Solo uno por proceso.",
      color: "#16a34a",
      group: "control",
      configurable: false,
      ports: ["NEXT"],
    },
    {
      type: "FIN",
      label: "Fin",
      description: "Termina la ejecución.",
      color: "#16a34a",
      group: "control",
      configurable: false,
      ports: [],
    },
    {
      type: "IF",
      label: "Condición",
      description: "Dos salidas: SI y NO.",
      color: "#d97706",
      group: "decision",
      configurable: true,
      ports: ["SI", "NO"],
    },
    {
      type: "SWITCH",
      label: "Varios caminos",
      description: "Una salida por cada valor.",
      color: "#d97706",
      group: "decision",
      configurable: true,
      ports: [],
    },
    {
      type: "WAIT",
      label: "Esperar",
      description: "Pausa un tiempo o hasta una fecha, sin ocupar el motor.",
      color: "#7c3aed",
      group: "decision",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "APPROVAL",
      label: "Aprobación",
      description: "Espera a que una persona apruebe o rechace.",
      color: "#7c3aed",
      group: "decision",
      configurable: true,
      ports: ["APROBADO", "RECHAZADO", "VENCIDO"],
    },
    {
      type: "NEXA",
      label: "NEXA",
      description: "La IA clasifica, resume o propone respuesta.",
      color: "#9333ea",
      group: "decision",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "NOTIFY",
      label: "Notificar",
      description: "Aviso en la campana (y correo si está activo).",
      color: "#0891b2",
      group: "comunicacion",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "EMAIL",
      label: "Correo",
      description: "Correo por Microsoft Graph.",
      color: "#0891b2",
      group: "comunicacion",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_CREATE",
      label: "Crear ticket",
      description: "Crea un ticket nuevo.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_ASSIGN",
      label: "Asignar agente",
      description: "Asigna un agente concreto.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_ASSIGN_TEAM",
      label: "Asignar equipo",
      description: "Pasa el ticket a un equipo; el agente lo elige el equipo.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_STATUS",
      label: "Cambiar estado",
      description: "Mueve el ticket de estado.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_PRIORITY",
      label: "Cambiar prioridad",
      description: "Cambia la prioridad.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_CATEGORY",
      label: "Cambiar categoría",
      description: "Cambia la categoría.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_COMMENT",
      label: "Comentar",
      description: "Añade un comentario o nota interna.",
      color: "#2563eb",
      group: "ticket",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_CLOSE",
      label: "Cerrar",
      description: "Cierra el ticket.",
      color: "#2563eb",
      group: "ticket",
      configurable: false,
      ports: ["NEXT"],
    },
    {
      type: "TICKET_REOPEN",
      label: "Reabrir",
      description: "Reabre el ticket.",
      color: "#2563eb",
      group: "ticket",
      configurable: false,
      ports: ["NEXT"],
    },
    {
      type: "SLA_APPLY",
      label: "Aplicar SLA",
      description: "Recalcula el SLA o fuerza una política.",
      color: "#ea580c",
      group: "otros",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "TASK_CREATE",
      label: "Crear tarea",
      description: "Crea una tarea.",
      color: "#ea580c",
      group: "otros",
      configurable: true,
      ports: ["NEXT"],
    },
    {
      type: "AUDIT",
      label: "Registrar auditoría",
      description: "Deja un asiento en la auditoría.",
      color: "#64748b",
      group: "otros",
      configurable: true,
      ports: ["NEXT"],
    },
  ];

  readonly grupos = [
    { id: "control", titulo: "Control" },
    { id: "decision", titulo: "Lógica, esperas e IA" },
    { id: "ticket", titulo: "Tickets" },
    { id: "comunicacion", titulo: "Comunicación" },
    { id: "otros", titulo: "SLA, tareas y auditoría" },
  ] as const;

  readonly iconos: Record<string, string> = {
    INICIO: "fa-solid fa-play",
    FIN: "fa-solid fa-flag-checkered",
    IF: "fa-solid fa-code-branch",
    SWITCH: "fa-solid fa-shuffle",
    WAIT: "fa-solid fa-hourglass-half",
    APPROVAL: "fa-solid fa-user-check",
    NEXA: "fa-solid fa-robot",
    NOTIFY: "fa-solid fa-bell",
    EMAIL: "fa-solid fa-envelope",
    TICKET_CREATE: "fa-solid fa-ticket",
    TICKET_ASSIGN: "fa-solid fa-user-tag",
    TICKET_ASSIGN_TEAM: "fa-solid fa-users",
    TICKET_STATUS: "fa-solid fa-arrows-rotate",
    TICKET_PRIORITY: "fa-solid fa-arrow-up-wide-short",
    TICKET_CATEGORY: "fa-solid fa-tags",
    TICKET_COMMENT: "fa-solid fa-comment",
    TICKET_CLOSE: "fa-solid fa-lock",
    TICKET_REOPEN: "fa-solid fa-lock-open",
    SLA_APPLY: "fa-solid fa-stopwatch",
    TASK_CREATE: "fa-solid fa-list-check",
    AUDIT: "fa-solid fa-shield-halved",
  };

  /** Prueba en curso: se anima en vivo sobre el grafo publicado, sin salir del constructor. */
  readonly prueba = signal<{
    ejecucionId: string;
    grafo: WorkflowGraph;
  } | null>(null);
  readonly pasosPrueba = signal<PasoAnimable[]>([]);
  readonly finPrueba = signal<FinAnimable | null>(null);
  private seguimientoPrueba?: Subscription;

  constructor(
    private workflowService: WorkflowService,
    private adminService: AdminService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private enVivo: WorkflowEnVivoService,
  ) {}

  ngOnDestroy(): void {
    this.seguimientoPrueba?.unsubscribe();
  }

  // ============================ Derivados ============================

  readonly nodoActual = computed(() => {
    const id = this.nodoSeleccionado();
    return id ? (this.grafo().nodes.find((n) => n.id === id) ?? null) : null;
  });

  readonly puedeGuardar = computed(
    () => this.grafo().nodes.length > 0 && !this.guardando(),
  );

  /** Tipos que el servidor sabe ejecutar. Sin catálogo, se ofrece la paleta entera. */
  readonly paletaDisponible = computed(() => {
    const cat = this.catalogo();
    if (!cat) return this.paleta;
    const conocidos = new Set(cat.nodos.map((n) => n.tipo));
    return this.paleta.filter((p) => conocidos.has(p.type));
  });

  readonly disparadorActual = computed(() => {
    const tipo = this.workflow()?.triggerType;
    return this.catalogo()?.disparadores.find((d) => d.tipo === tipo) ?? null;
  });

  /** Errores de validación agrupados por nodo, para marcarlos en el lienzo. */
  readonly erroresPorNodo = computed(() => {
    const mapa = new Map<string, string[]>();
    for (const e of this.errores()) {
      for (const n of this.grafo().nodes) {
        if (e.includes(`'${n.id}'`) || e.includes(`'${n.name}'`)) {
          mapa.set(n.id, [...(mapa.get(n.id) ?? []), e]);
        }
      }
    }
    return mapa;
  });

  readonly aristas = computed<Arista[]>(() => {
    const porId = new Map(this.grafo().nodes.map((n) => [n.id, n]));
    const resultado: Arista[] = [];
    for (const edge of this.grafo().edges) {
      const desde = porId.get(edge.from);
      const hasta = porId.get(edge.to);
      if (!desde || !hasta) continue;
      const p1 = this.posPuerto(desde, edge.sourcePort);
      const x2 = hasta.positionX + this.ANCHO_NODO / 2;
      const y2 = hasta.positionY;
      resultado.push({
        edge,
        path: this.curva(p1.x, p1.y, x2, y2),
        etiqueta: edge.sourcePort === "NEXT" ? null : edge.sourcePort,
        lx: (p1.x + x2) / 2,
        ly: (p1.y + y2) / 2,
        color: this.colorDe(desde.type),
      });
    }
    return resultado;
  });

  /**
   * Un marcador de punta por cada color distinto: los marcadores SVG no heredan
   * el color del trazo al que se enganchan, así que cada color necesita el suyo.
   */
  readonly marcasAristas = computed(() => {
    const vistos = new Map<string, string>();
    for (const a of this.aristas()) if (!vistos.has(a.color)) vistos.set(a.color, this.idColor(a.color));
    return [...vistos].map(([color, id]) => ({ id, color }));
  });

  /** Identificador de marcador para un color (#16a34a → 16a34a; el '#' rompe la url()). */
  idColor(color: string): string {
    return color.replace("#", "");
  }

  /** Color del conector que se está dibujando ahora (hereda el del nodo de origen). */
  colorConexion(): string {
    const c = this.conexion();
    if (!c) return "#2563eb";
    const nodo = this.grafo().nodes.find((n) => n.id === c.origen);
    return nodo ? this.colorDe(nodo.type) : "#2563eb";
  }

  // ============================ Carga ============================

  ngOnInit(): void {
    this.workflowService.catalogo().subscribe({
      next: (c) => this.catalogo.set(c),
      error: () =>
        this.toast.warn(
          "No se pudo leer el catálogo del motor; se usa la paleta local",
        ),
    });
    this.adminService
      .catalog()
      .subscribe({ next: (c) => this.lookups.set(c), error: () => undefined });
    this.adminService
      .agents()
      .subscribe({ next: (a) => this.agentes.set(a), error: () => undefined });

    const id = this.route.snapshot.paramMap.get("id");
    if (!id) {
      this.cargando.set(false);
      this.grafo.set({
        name: "Proceso nuevo",
        nodes: [],
        edges: [],
        variables: {},
      });
      return;
    }
    this.workflowId.set(id);
    this.recargarDetalle(true);
  }

  private recargarDetalle(conGrafo: boolean): void {
    const id = this.workflowId();
    if (!id) return;
    this.workflowService.detalle(id).subscribe({
      next: (detalle) => {
        this.workflow.set(detalle);
        this.prepararAjustes(detalle);
        if (conGrafo) this.cargarGrafoDeLaVersionActual(detalle);
        this.cargando.set(false);
      },
      error: () => {
        this.toast.error("No se pudo cargar el workflow");
        this.cargando.set(false);
      },
    });
  }

  /** Abre la versión vigente: es la que el motor ejecuta y la que se quiere ver. */
  private cargarGrafoDeLaVersionActual(detalle: WorkflowDetail): void {
    const version =
      detalle.versions.find((v) => v.current) ?? detalle.versions[0];
    if (!version) {
      this.grafo.set({
        name: detalle.name,
        nodes: [],
        edges: [],
        variables: {},
      });
      return;
    }
    try {
      const parsed = JSON.parse(version.definition) as WorkflowGraph;
      this.grafo.set({
        name: parsed.name || detalle.name,
        nodes: (parsed.nodes ?? []).map((n) => ({
          ...n,
          config: n.config ?? {},
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
        })),
        edges: (parsed.edges ?? []).map((e) => ({
          ...e,
          sourcePort: e.sourcePort || "NEXT",
        })),
        variables: parsed.variables ?? {},
      });
      this.cambiosSinPublicar.set(false);
    } catch {
      this.toast.error(
        "La versión guardada no se pudo leer. Se empieza con un grafo vacío.",
      );
      this.grafo.set({
        name: detalle.name,
        nodes: [],
        edges: [],
        variables: {},
      });
    }
  }

  private prepararAjustes(d: WorkflowDetail): void {
    let programacion: ScheduleConfig = { modo: "INTERVALO", minutos: 60 };
    if (d.triggerType === "SCHEDULED" && d.triggerConfig) {
      try {
        programacion = { ...programacion, ...JSON.parse(d.triggerConfig) };
      } catch {
        // Configuración ilegible: se ofrece la de por defecto para corregirla.
      }
    }
    this.ajustes = {
      name: d.name,
      description: d.description ?? "",
      triggerType: d.triggerType,
      programacion,
    };
  }

  // ============================ Nodos ============================

  /** Añade un nodo en la zona visible del lienzo. */
  agregar(tipo: WorkflowNodeType): void {
    const entrada = this.paleta.find((p) => p.type === tipo);
    const nodos = this.grafo().nodes;
    if (tipo === "INICIO" && nodos.some((n) => n.type === "INICIO")) {
      // Con dos inicios el motor no sabría por dónde empezar.
      this.toast.warn("El proceso ya tiene un nodo de inicio");
      return;
    }
    const el = this.lienzo?.nativeElement;
    const z = this.zoom();
    const baseX = el ? el.scrollLeft / z + 60 : 80;
    const baseY = el ? el.scrollTop / z + 60 : 80;
    const nodo: WorkflowNode = {
      id: this.generarId(tipo, nodos),
      type: tipo,
      name: entrada?.label ?? tipo,
      config: this.configPorDefecto(tipo),
      positionX: this.ajustar(baseX + (nodos.length % 3) * 40),
      positionY: this.ajustar(baseY + (nodos.length % 3) * 40),
    };
    this.cambiarGrafo((g) => ({ ...g, nodes: [...g.nodes, nodo] }));
    this.nodoSeleccionado.set(nodo.id);
  }

  /** Id corto y legible: el JSON exportado se entiende de un vistazo. */
  private generarId(tipo: WorkflowNodeType, nodos: WorkflowNode[]): string {
    const base = tipo.toLowerCase();
    let i = 1;
    while (nodos.some((n) => n.id === `${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  private configPorDefecto(tipo: WorkflowNodeType): Record<string, unknown> {
    switch (tipo) {
      case "IF":
        return { campo: "ticket.prioridad", operador: "==", valor: "CRITICA" };
      case "SWITCH":
        return { campo: "ticket.prioridad", casos: [], por_defecto: "" };
      case "WAIT":
        return { minutos: 60 };
      case "APPROVAL":
        return {
          rol: "ADMIN",
          mensaje: "Aprobar el paso del ticket #{{ticket.numero}}",
        };
      case "NOTIFY":
        return { mensaje: "", destino: "AGENTE" };
      case "EMAIL":
        return { para: "{{ticket.solicitanteCorreo}}", asunto: "", cuerpo: "" };
      case "TICKET_COMMENT":
        return { mensaje: "", interno: true };
      case "TICKET_STATUS":
        return { estado: "EN_PROCESO" };
      case "TICKET_CREATE":
        return { titulo: "", descripcion: "" };
      case "TASK_CREATE":
        return { titulo: "", estado: "PENDIENTE" };
      case "NEXA":
        return { accion: "CLASIFICAR", instrucciones: "" };
      case "AUDIT":
        return { accion: "WORKFLOW_PASO", detalle: "" };
      default:
        return {};
    }
  }

  eliminarNodo(id: string): void {
    // Los conectores que entran o salen se van con el nodo: dejarlos daría
    // líneas hacia la nada, un grafo que parece válido y no lo es.
    this.cambiarGrafo((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== id),
      edges: g.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    if (this.nodoSeleccionado() === id) this.nodoSeleccionado.set(null);
  }

  duplicarNodo(id: string): void {
    const original = this.grafo().nodes.find((n) => n.id === id);
    if (!original || original.type === "INICIO") return;
    const copia: WorkflowNode = {
      ...original,
      id: this.generarId(original.type, this.grafo().nodes),
      name: `${original.name} (copia)`,
      config: JSON.parse(JSON.stringify(original.config ?? {})),
      positionX: original.positionX + 30,
      positionY: original.positionY + 30,
    };
    this.cambiarGrafo((g) => ({ ...g, nodes: [...g.nodes, copia] }));
    this.nodoSeleccionado.set(copia.id);
  }

  // ============================ Puertos y conectores ============================

  puertosDe(nodo: WorkflowNode): string[] {
    if (nodo.type === "SWITCH") {
      const salidas = this.casosDe(nodo)
        .map((c) => c.salida)
        .filter((s) => !!s);
      const defecto = String(nodo.config?.["por_defecto"] ?? "");
      return [...new Set(defecto ? [...salidas, defecto] : salidas)];
    }
    const delServidor = this.catalogo()?.nodos.find(
      (n) => n.tipo === nodo.type,
    )?.puertos;
    return (
      delServidor ?? this.paleta.find((p) => p.type === nodo.type)?.ports ?? []
    );
  }

  /** Posición del puerto en el borde inferior de la caja. */
  posPuerto(nodo: WorkflowNode, puerto: string): { x: number; y: number } {
    const puertos = this.puertosDe(nodo);
    const i = Math.max(0, puertos.indexOf(puerto));
    const n = Math.max(1, puertos.length);
    return {
      x: nodo.positionX + (this.ANCHO_NODO * (i + 1)) / (n + 1),
      y: nodo.positionY + this.ALTO_NODO,
    };
  }

  private curva(x1: number, y1: number, x2: number, y2: number): string {
    const d = Math.max(40, Math.abs(y2 - y1) / 2);
    return `M ${x1} ${y1} C ${x1} ${y1 + d}, ${x2} ${y2 - d}, ${x2} ${y2}`;
  }

  conectar(origenId: string, destinoId: string, puerto: string): void {
    const g = this.grafo();
    if (origenId === destinoId) {
      this.toast.warn("Un nodo no puede conectarse a sí mismo");
      return;
    }
    const destino = g.nodes.find((n) => n.id === destinoId);
    if (destino?.type === "INICIO") {
      this.toast.warn("Nada puede llegar al nodo de inicio");
      return;
    }
    // Cada puerto tiene una sola salida: con dos, el motor no sabría cuál seguir.
    const sinEse = g.edges.filter(
      (e) => !(e.from === origenId && e.sourcePort === puerto),
    );
    this.cambiarGrafo((gg) => ({
      ...gg,
      edges: [
        ...sinEse,
        {
          from: origenId,
          to: destinoId,
          sourcePort: puerto,
          label: puerto === "NEXT" ? null : puerto,
        },
      ],
    }));
  }

  quitarConector(edge: WorkflowEdge): void {
    this.cambiarGrafo((g) => ({
      ...g,
      edges: g.edges.filter(
        (e) =>
          !(
            e.from === edge.from &&
            e.to === edge.to &&
            e.sourcePort === edge.sourcePort
          ),
      ),
    }));
  }

  clicEnConector(edge: WorkflowEdge): void {
    const desde =
      this.grafo().nodes.find((n) => n.id === edge.from)?.name ?? edge.from;
    const hasta =
      this.grafo().nodes.find((n) => n.id === edge.to)?.name ?? edge.to;
    void Swal.fire({
      title: "¿Quitar el conector?",
      html: `
        <p style="font-size:13px;color:#64748b;margin:0">
          De <b>«${desde}»</b> a <b>«${hasta}»</b>.
        </p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      focusCancel: true,
    }).then((r) => {
      if (r.isConfirmed) this.quitarConector(edge);
    });
  }

  destinoDe(nodo: WorkflowNode, puerto: string): string {
    return (
      this.grafo().edges.find(
        (e) => e.from === nodo.id && e.sourcePort === puerto,
      )?.to ?? ""
    );
  }

  /** Alternativa accesible al arrastre: elegir el destino en una lista. */
  conectarDesdeLista(
    nodo: WorkflowNode,
    puerto: string,
    destinoId: string,
  ): void {
    if (!destinoId) {
      const e = this.grafo().edges.find(
        (x) => x.from === nodo.id && x.sourcePort === puerto,
      );
      if (e) this.quitarConector(e);
      return;
    }
    this.conectar(nodo.id, destinoId, puerto);
  }

  // ============================ Puntero: arrastre, conexión, paneo ============================

  /** Coordenadas de lienzo (sin zoom ni scroll) de un evento de puntero. */
  private puntoLienzo(ev: PointerEvent): { x: number; y: number } {
    const el = this.lienzo?.nativeElement;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const z = this.zoom();
    return {
      x: (ev.clientX - r.left + el.scrollLeft) / z,
      y: (ev.clientY - r.top + el.scrollTop) / z,
    };
  }

  iniciarArrastre(ev: PointerEvent, nodo: WorkflowNode): void {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    this.nodoSeleccionado.set(nodo.id);
    this.arrastre = {
      id: nodo.id,
      px: ev.clientX,
      py: ev.clientY,
      nx: nodo.positionX,
      ny: nodo.positionY,
    };
  }

  iniciarConexion(ev: PointerEvent, nodo: WorkflowNode, puerto: string): void {
    ev.stopPropagation();
    ev.preventDefault();
    const p = this.posPuerto(nodo, puerto);
    this.conexion.set({
      origen: nodo.id,
      puerto,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
    });
  }

  iniciarPaneo(ev: PointerEvent): void {
    const el = this.lienzo?.nativeElement;
    if (!el || ev.button !== 0) return;
    this.nodoSeleccionado.set(null);
    this.paneo = {
      x: ev.clientX,
      y: ev.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
  }

  @HostListener("window:pointermove", ["$event"])
  alMover(ev: PointerEvent): void {
    if (this.arrastre) {
      const z = this.zoom();
      const a = this.arrastre;
      const x = Math.max(0, this.ajustar(a.nx + (ev.clientX - a.px) / z));
      const y = Math.max(0, this.ajustar(a.ny + (ev.clientY - a.py) / z));
      this.grafo.update((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === a.id ? { ...n, positionX: x, positionY: y } : n,
        ),
      }));
      this.cambiosSinPublicar.set(true);
    } else if (this.conexion()) {
      const p = this.puntoLienzo(ev);
      this.conexion.update((c) => (c ? { ...c, x2: p.x, y2: p.y } : c));
    } else if (this.paneo && this.lienzo) {
      const el = this.lienzo.nativeElement;
      el.scrollLeft = this.paneo.sl - (ev.clientX - this.paneo.x);
      el.scrollTop = this.paneo.st - (ev.clientY - this.paneo.y);
    }
  }

  @HostListener("window:pointerup", ["$event"])
  alSoltar(ev: PointerEvent): void {
    const c = this.conexion();
    if (c) {
      const p = this.puntoLienzo(ev);
      const destino = this.grafo().nodes.find(
        (n) =>
          p.x >= n.positionX &&
          p.x <= n.positionX + this.ANCHO_NODO &&
          p.y >= n.positionY &&
          p.y <= n.positionY + this.ALTO_NODO,
      );
      if (destino) this.conectar(c.origen, destino.id, c.puerto);
      this.conexion.set(null);
    }
    this.arrastre = null;
    this.paneo = null;
  }

  rutaConexion(): string {
    const c = this.conexion();
    return c ? this.curva(c.x1, c.y1, c.x2, c.y2) : "";
  }

  private ajustar(v: number): number {
    return Math.round(v / this.REJILLA) * this.REJILLA;
  }

  // ============================ Zoom ============================

  cambiarZoom(delta: number): void {
    this.zoom.set(
      Math.min(1.6, Math.max(0.4, Math.round((this.zoom() + delta) * 10) / 10)),
    );
  }

  zoomRueda(ev: WheelEvent): void {
    if (!ev.ctrlKey) return;
    ev.preventDefault();
    this.cambiarZoom(ev.deltaY < 0 ? 0.1 : -0.1);
  }

  /** Ajusta el zoom y el scroll para que se vea todo el grafo. */
  encuadrar(): void {
    const nodos = this.grafo().nodes;
    const el = this.lienzo?.nativeElement;
    if (!el || nodos.length === 0) return;
    const minX = Math.min(...nodos.map((n) => n.positionX));
    const minY = Math.min(...nodos.map((n) => n.positionY));
    const maxX = Math.max(...nodos.map((n) => n.positionX + this.ANCHO_NODO));
    const maxY = Math.max(
      ...nodos.map((n) => n.positionY + this.ALTO_NODO + 30),
    );
    const z = Math.min(
      1.2,
      Math.max(
        0.4,
        Math.min(
          el.clientWidth / (maxX - minX + 80),
          el.clientHeight / (maxY - minY + 80),
        ),
      ),
    );
    this.zoom.set(Math.round(z * 10) / 10);
    setTimeout(() => {
      el.scrollLeft = (minX - 40) * this.zoom();
      el.scrollTop = (minY - 40) * this.zoom();
    });
  }

  // ============================ Configuración ============================

  renombrarNodo(id: string, nombre: string): void {
    this.cambiarGrafo((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, name: nombre } : n)),
    }));
  }

  casosDe(nodo: WorkflowNode | null): { valor: string; salida: string }[] {
    const bruto = nodo?.config?.["casos"];
    return Array.isArray(bruto)
      ? (bruto as { valor: string; salida: string }[])
      : [];
  }

  /** Una línea con lo esencial de la configuración, para la caja del lienzo. */
  resumen(nodo: WorkflowNode): string {
    const c = nodo.config ?? {};
    const l = this.lookups();
    const nombre = (
      lista: { id: string; name: string }[] | undefined,
      id: unknown,
    ) =>
      lista?.find((x) => String(x.id) === String(id))?.name ?? String(id ?? "");
    switch (nodo.type) {
      case "IF":
        return `${c["campo"] ?? "?"} ${c["operador"] ?? ""} ${c["valor"] ?? ""}`;
      case "SWITCH":
        return `Según ${c["campo"] ?? "?"}`;
      case "WAIT":
        return c["minutos"]
          ? `${c["minutos"]} min`
          : c["hasta"]
            ? `Hasta ${c["hasta"]}`
            : "Sin plazo";
      case "APPROVAL":
        return `Aprueba ${c["rol"] ?? "?"}${c["horas_limite"] ? ` · ${c["horas_limite"]} h` : ""}`;
      case "NEXA":
        return String(c["accion"] ?? "CLASIFICAR");
      case "NOTIFY":
        return `A ${c["destino"] ?? c["rol"] ?? c["correo"] ?? c["usuarioId"] ?? "?"}`;
      case "EMAIL":
        return `A ${c["para"] ?? "?"}`;
      case "TICKET_STATUS":
        return String(c["estado"] ?? "");
      case "TICKET_PRIORITY":
        return nombre(l?.priorities, c["prioridadId"]);
      case "TICKET_CATEGORY":
        return nombre(l?.categories, c["categoriaId"]);
      case "TICKET_ASSIGN_TEAM":
        return nombre(l?.teams, c["equipoId"]);
      case "TICKET_ASSIGN": {
        const a = this.agentes().find(
          (x) => String(x.idUser) === String(c["agenteId"]),
        );
        return a
          ? (a.displayName ?? a.corporateEmailUser)
          : String(c["agenteId"] ?? "");
      }
      case "SLA_APPLY":
        return c["politicaId"]
          ? nombre(l?.slaPolicies, c["politicaId"])
          : "Según reglas";
      case "TICKET_CREATE":
      case "TASK_CREATE":
        return String(c["titulo"] ?? "");
      case "TICKET_COMMENT":
        return c["interno"] ? "Nota interna" : "Comentario público";
      case "AUDIT":
        return String(c["accion"] ?? "");
      default:
        return "";
    }
  }

  colorDe(tipo: string): string {
    return this.paleta.find((p) => p.type === tipo)?.color ?? "#64748b";
  }

  etiquetaTipo(tipo: string): string {
    return this.paleta.find((p) => p.type === tipo)?.label ?? tipo;
  }

  /** Toda edición pasa por aquí para saber que hay algo sin publicar. */
  cambiarGrafo(fn: (g: WorkflowGraph) => WorkflowGraph): void {
    this.grafo.update(fn);
    this.cambiosSinPublicar.set(true);
  }

  // ============================ Ajustes del workflow ============================

  guardarAjustes(): void {
    const id = this.workflowId();
    if (!id) return;
    const a = this.ajustes;
    const config =
      a.triggerType === "SCHEDULED"
        ? JSON.stringify(this.limpiarProgramacion(a.programacion))
        : "{}";
    this.workflowService
      .actualizar(id, {
        name: a.name.trim(),
        description: a.description?.trim() || null,
        triggerType: a.triggerType,
        triggerConfig: config,
      })
      .subscribe({
        next: () => {
          this.toast.success("Ajustes guardados");
          this.mostrarAjustes.set(false);
          this.recargarDetalle(false);
        },
        error: (e) =>
          this.toast.error(
            e?.error?.message ?? "No se pudieron guardar los ajustes",
          ),
      });
  }

  private limpiarProgramacion(p: ScheduleConfig): ScheduleConfig {
    if (p.modo === "INTERVALO")
      return { modo: "INTERVALO", minutos: Number(p.minutos) };
    if (p.modo === "CRON") return { modo: "CRON", cron: (p.cron ?? "").trim() };
    // datetime-local no lleva zona: se interpreta como hora de Ecuador.
    const f = (p.fecha ?? "").trim();
    return { modo: "FECHA", fecha: f.length === 16 ? `${f}:00-05:00` : f };
  }

  // ============================ Validar, publicar, activar, probar ============================

  validar(): void {
    const id = this.workflowId();
    if (!id) return;
    this.workflowService.validar(id, this.grafo()).subscribe({
      next: (r: GraphValidation) => {
        this.errores.set(r.errors);
        if (r.valid) this.toast.success("El workflow está listo para publicar");
      },
      error: () => this.toast.error("No se pudo validar"),
    });
  }

  publicar(): void {
    const id = this.workflowId();
    if (!id || this.guardando()) return;
    this.guardando.set(true);
    this.errores.set([]);
    this.workflowService.publicarVersion(id, this.grafo()).subscribe({
      next: (version) => {
        this.guardando.set(false);
        this.cambiosSinPublicar.set(false);
        this.toast.success(`Versión ${version.version} publicada`);
        this.recargarDetalle(false);
      },
      error: (e) => {
        this.guardando.set(false);
        const detalle: string =
          e?.error?.message ?? "No se pudo publicar la versión";
        // El servidor devuelve todos los problemas en un solo mensaje.
        this.errores.set(
          detalle
            .replace(/^El workflow no es válido:\s*/, "")
            .split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ¿])/),
        );
        this.toast.error("El workflow tiene errores");
      },
    });
  }

  alternarActivo(): void {
    const w = this.workflow();
    if (!w) return;
    const accion = w.active
      ? this.workflowService.desactivar(w.id)
      : this.workflowService.activar(w.id);
    accion.subscribe({
      next: () => {
        this.toast.success(
          w.active ? "Workflow desactivado" : "Workflow activado",
        );
        this.recargarDetalle(false);
      },
      error: (e) =>
        this.toast.error(e?.error?.message ?? "No se pudo cambiar el estado"),
    });
  }

  /** Ejecuta la versión publicada sobre un ticket (o usuario) y abre su recorrido. */
  async probar(): Promise<void> {
    const w = this.workflow();
    if (!w) return;

    if (this.cambiosSinPublicar()) {
      this.toast.warn(
        "Hay cambios sin publicar: la prueba usa la versión publicada",
      );
    }

    const entidad = this.disparadorActual()?.entidad;
    const esUsuario = entidad === "USUARIO";
    const label = esUsuario
      ? "Correo del usuario para la prueba"
      : "Número del ticket para la prueba";
    const placeholder = esUsuario ? "Ej. ana@coac.ec" : "Ej. 1234";
    const ayuda = esUsuario
      ? "Se ejecutará sobre este usuario. Déjalo vacío si el disparador no necesita uno."
      : "Se ejecutará sobre este ticket. Déjalo vacío si el disparador no necesita uno.";

    const r = await Swal.fire({
      title: "Probar el proceso",
      html: `
      <p style="font-size:13px;color:#64748b;margin:0 0 12px 0">
        ${ayuda}
      </p>
    `,
      input: esUsuario ? "email" : "number",
      inputLabel: label,
      inputPlaceholder: placeholder,
      inputAttributes: esUsuario ? { autocapitalize: "off", autocorrect: "off" } : {
        min: "1",
        step: "1",
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Ejecutar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#062e86",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      inputValidator: (v: string) => {
        // Vacío es válido: hay disparadores que no necesitan entidad.
        if (v === "" || v === null || v === undefined) return null;
        if (esUsuario) {
          return /^[^@\s]+@[^@\s]+$/.test(v.trim()) ? null : "Indica un correo válido";
        }
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
          return "Indica un número de ticket válido (entero mayor que 0)";
        }
        return null;
      },
      customClass: {
        input: "swal2-input-custom",
      },
    });

    if (!r.isConfirmed) return;

    // El backend traduce el número del ticket o el correo a su uuid.
    const valor = ((r.value as string | null) ?? "").trim();
    const payload: Record<string, unknown> = {};
    if (valor) {
      payload[esUsuario ? "usuarioId" : "ticketId"] = valor;
    }

    this.workflowService.ejecutarAhora(w.id, payload).subscribe({
      next: (e) => this.abrirPrueba(e.id),
      error: (err) =>
        this.toast.error(err?.error?.message ?? "No se pudo ejecutar"),
    });
  }

  /**
   * Abre el lienzo de ejecución y lo sigue en vivo. Se dibuja sobre la versión
   * publicada, que es la que corre: si hay cambios sin publicar, el grafo del
   * editor no coincidiría con el recorrido.
   */
  private abrirPrueba(ejecucionId: string): void {
    const publicada = this.workflow()?.versions.find((v) => v.current);
    let grafo = this.grafo();
    if (publicada && this.cambiosSinPublicar()) {
      try {
        grafo = JSON.parse(publicada.definition) as WorkflowGraph;
      } catch {
        // Definición ilegible: se anima sobre el grafo del editor.
      }
    }
    this.seguimientoPrueba?.unsubscribe();
    this.pasosPrueba.set([]);
    this.finPrueba.set(null);
    this.prueba.set({ ejecucionId, grafo });
    this.seguimientoPrueba = this.enVivo
      .seguir(ejecucionId)
      .subscribe((estado) => {
        this.pasosPrueba.set(estado.pasos);
        this.finPrueba.set(estado.fin);
      });
  }

  cerrarPrueba(): void {
    this.seguimientoPrueba?.unsubscribe();
    this.prueba.set(null);
  }

  verPruebaEnHistorial(): void {
    const p = this.prueba();
    const id = this.workflowId();
    if (!p || !id) return;
    this.cerrarPrueba();
    this.router.navigate(["/workflows", id, "ejecuciones"], {
      queryParams: { ver: p.ejecucionId },
    });
  }

  irAlHistorial(): void {
    const id = this.workflowId();
    if (id) this.router.navigate(["/workflows", id, "ejecuciones"]);
  }

  // ============================ Ejemplo ============================

  /**
   * Carga el workflow de ejemplo "Escalamiento automático de tickets críticos"
   * con los ids reales de este sistema (prioridad, equipo, política de SLA).
   */
  async cargarEjemplo(): Promise<void> {
    if (this.grafo().nodes.length > 0) {
      const r = await Swal.fire({
        title: "¿Reemplazar el grafo actual?",
        html: `
        <p style="font-size:13px;color:#64748b;margin:0">
          Se va a cargar el ejemplo <b>Escalamiento automático de tickets críticos</b>
          y se perderá el grafo que tienes ahora.
        </p>
      `,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, reemplazar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#d97706",
        cancelButtonColor: "#64748b",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!r.isConfirmed) return;
    }

    const l = this.lookups();
    const buscar = (
      lista: { id: string; name: string }[] | undefined,
      ...nombres: string[]
    ) =>
      lista?.find((x) => nombres.some((n) => x.name.toUpperCase().includes(n)))
        ?.id ?? "";
    const critica = buscar(l?.priorities, "CRITIC", "CRÍTIC");
    const infra = buscar(l?.teams, "INFRA");
    const slaCritico = buscar(l?.slaPolicies, "CRITIC", "CRÍTIC");

    const n = (
      id: string,
      type: WorkflowNodeType,
      name: string,
      x: number,
      y: number,
      config: Record<string, unknown> = {},
    ): WorkflowNode => ({ id, type, name, config, positionX: x, positionY: y });

    this.grafo.set({
      name:
        this.workflow()?.name ?? "Escalamiento automático de tickets críticos",
      nodes: [
        n("inicio", "INICIO", "Ticket creado", 300, 40),
        n("nexa", "NEXA", "NEXA analiza", 300, 170, {
          accion: "CLASIFICAR",
          instrucciones:
            "Es CRITICA si afecta a varias agencias, al core financiero o a la atención al socio.",
        }),
        n("critico", "IF", "¿Prioridad crítica?", 300, 300, {
          campo: "nodos.nexa.prioridad",
          operador: "==",
          valor: "CRITICA",
        }),
        n("aviso", "NOTIFY", "Notificar supervisor", 120, 440, {
          rol: "ADMIN",
          titulo: "Ticket crítico #{{ticket.numero}}",
          mensaje:
            'NEXA clasificó como CRÍTICO el ticket #{{ticket.numero}} "{{ticket.titulo}}": {{nodos.nexa.resumen}}',
        }),
        n("prioridad", "TICKET_PRIORITY", "Subir a crítica", 120, 570, {
          prioridadId: critica,
        }),
        n("equipo", "TICKET_ASSIGN_TEAM", "Asignar Infraestructura", 120, 700, {
          equipoId: infra,
        }),
        n(
          "sla",
          "SLA_APPLY",
          "Aplicar SLA crítico",
          120,
          830,
          slaCritico ? { politicaId: slaCritico } : {},
        ),
        n("auditoria", "AUDIT", "Registrar auditoría", 120, 960, {
          accion: "WORKFLOW_ESCALAMIENTO_CRITICO",
          detalle:
            "Ticket #{{ticket.numero}} escalado al equipo {{ticket.equipo}} por NEXA (confianza {{nodos.nexa.confianza}})",
        }),
        n("fin_si", "FIN", "Fin", 120, 1090),
        n("fin_no", "FIN", "Fin (no crítico)", 480, 440),
      ],
      edges: [
        { from: "inicio", to: "nexa", sourcePort: "NEXT" },
        { from: "nexa", to: "critico", sourcePort: "NEXT" },
        { from: "critico", to: "aviso", sourcePort: "SI", label: "SI" },
        { from: "critico", to: "fin_no", sourcePort: "NO", label: "NO" },
        { from: "aviso", to: "prioridad", sourcePort: "NEXT" },
        { from: "prioridad", to: "equipo", sourcePort: "NEXT" },
        { from: "equipo", to: "sla", sourcePort: "NEXT" },
        { from: "sla", to: "auditoria", sourcePort: "NEXT" },
        { from: "auditoria", to: "fin_si", sourcePort: "NEXT" },
      ],
      variables: {},
    });

    this.cambiosSinPublicar.set(true);

    if (!critica || !infra) {
      this.toast.warn(
        "No se encontró la prioridad CRÍTICA o el equipo de Infraestructura: revísalos en los nodos",
      );
    }
    setTimeout(() => this.encuadrar());
  }
}

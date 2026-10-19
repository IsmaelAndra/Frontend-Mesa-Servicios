import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FinAnimable, PasoAnimable, WorkflowGraph, WorkflowNode } from '../../../models/workflow.model';

type Fase = 'parado' | 'viajando' | 'ejecutando' | 'resuelto' | 'esperando' | 'terminado';
type EstadoNodo = 'PENDIENTE' | 'EJECUTANDO' | 'COMPLETADO' | 'ERROR' | 'PAUSA' | 'NO_VISITADO';

/** Línea del grafo ya calculada, con sus puntos de control para mover el punto viajero. */
interface Linea {
  clave: string;
  from: string;
  to: string;
  path: string;
  etiqueta: string | null;
  lx: number;
  ly: number;
  p: [number, number, number, number, number, number, number, number];
  /** Color del nodo de origen: el conector hereda el color de su proceso. */
  color: string;
}

const COLORES: Record<string, string> = {
  INICIO: '#16a34a', FIN: '#16a34a', IF: '#d97706', SWITCH: '#d97706', WAIT: '#7c3aed', APPROVAL: '#7c3aed',
  NEXA: '#9333ea', NOTIFY: '#0891b2', EMAIL: '#0891b2', SLA_APPLY: '#ea580c', TASK_CREATE: '#ea580c', AUDIT: '#64748b',
};

const ICONOS: Record<string, string> = {
  INICIO: 'fa-solid fa-play', FIN: 'fa-solid fa-flag-checkered', IF: 'fa-solid fa-code-branch',
  SWITCH: 'fa-solid fa-shuffle', WAIT: 'fa-solid fa-hourglass-half', APPROVAL: 'fa-solid fa-user-check',
  NEXA: 'fa-solid fa-robot', NOTIFY: 'fa-solid fa-bell', EMAIL: 'fa-solid fa-envelope',
  TICKET_CREATE: 'fa-solid fa-ticket', TICKET_ASSIGN: 'fa-solid fa-user-tag', TICKET_ASSIGN_TEAM: 'fa-solid fa-users',
  TICKET_STATUS: 'fa-solid fa-arrows-rotate', TICKET_PRIORITY: 'fa-solid fa-arrow-up-wide-short',
  TICKET_CATEGORY: 'fa-solid fa-tags', TICKET_TYPE: 'fa-solid fa-shapes', TICKET_COMMENT: 'fa-solid fa-comment', TICKET_CLOSE: 'fa-solid fa-lock',
  TICKET_REOPEN: 'fa-solid fa-lock-open', SLA_APPLY: 'fa-solid fa-stopwatch', TASK_CREATE: 'fa-solid fa-list-check',
  AUDIT: 'fa-solid fa-shield-halved',
};

/**
 * Lienzo de ejecución: anima el recorrido de una ejecución de workflow sobre su grafo.
 *
 * <p>Sirve igual para el directo (los pasos llegan por SSE y se van añadiendo) y
 * para la repetición (llegan todos de golpe desde el historial). En los dos casos
 * el lienzo los reproduce de uno en uno a un ritmo legible: el motor real tarda
 * milisegundos por nodo y, a esa velocidad, no se vería nada.
 *
 * <p>Por cada paso: el punto viaja por el conector (≈380 ms), el nodo "trabaja"
 * (lo que tardó de verdad, acotado entre 0,45 y 1,1 s) y se resuelve en verde o
 * en rojo con su resultado. Si un paso sigue EJECUTANDO (NEXA pensando de verdad),
 * el lienzo se queda en él hasta que llegue su final.
 *
 * <p>Con "reducir movimiento" no hay punto viajero ni halos: solo cambios de color.
 */
@Component({
  selector: 'app-workflow-run-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-run-canvas.component.html',
  styleUrls: ['./workflow-run-canvas.component.css'],
})
export class WorkflowRunCanvasComponent implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('marco') marco?: ElementRef<HTMLDivElement>;

  @Input() grafo: WorkflowGraph | null = null;
  @Input() pasos: PasoAnimable[] = [];
  @Input() fin: FinAnimable | null = null;
  /** 'vivo' muestra el indicador de directo mientras no haya fin. */
  @Input() modo: 'vivo' | 'repeticion' = 'repeticion';
  /** Alto del marco del lienzo. */
  @Input() alto = 460;

  readonly ANCHO = 210;
  readonly ALTO = 70;
  private readonly MARGEN = 48;

  // Estado del reproductor
  readonly grafoS = signal<WorkflowGraph | null>(null);
  readonly pasosS = signal<PasoAnimable[]>([]);
  readonly finS = signal<FinAnimable | null>(null);
  /** Paso que se está animando (o el siguiente que toca). */
  readonly indice = signal(0);
  /** Cuántos pasos ya se resolvieron (se ven en verde o rojo). */
  readonly resueltos = signal(0);
  readonly fase = signal<Fase>('parado');
  readonly pausado = signal(false);
  readonly velocidad = signal<1 | 2>(1);
  /** Posición del punto que viaja por el conector; null si no hay viaje. */
  readonly punto = signal<{ x: number; y: number } | null>(null);
  /** Color del conector que el punto está recorriendo. */
  readonly colorPunto = signal<string | null>(null);
  readonly escala = signal(1);

  private temporizador?: ReturnType<typeof setTimeout>;
  private marcoRaf?: number;
  private observador?: ResizeObserver;
  readonly reducido =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  constructor(private zone: NgZone) {}


  // ============================ Ciclo de vida ============================

  ngOnChanges(): void {
    const grafoNuevo = this.grafo !== this.grafoS();
    this.grafoS.set(this.grafo);
    const antes = this.pasosS();
    this.pasosS.set(this.pasos ?? []);
    this.finS.set(this.fin);
    if (grafoNuevo && this.marco) setTimeout(() => this.ajustarEscala());

    // Si los pasos son de otra ejecución (no amplían los de antes), se empieza de cero.
    const otra = antes.length > 0 && (this.pasos.length === 0 || this.pasos[0].secuencia !== antes[0].secuencia);
    if (otra) {
      this.reiniciar();
      return;
    }
    // El reproductor estaba esperando datos (o aún no arrancó): sigue.
    if (this.esperandoDatos && !this.pausado()) {
      this.esperandoDatos = false;
      // Al arrancar, un respiro para que el lienzo se pinte antes del primer paso.
      this.programar(() => this.avanzar(), this.fase() === 'parado' ? 350 : 0);
    }
  }

  ngAfterViewInit(): void {
    this.ajustarEscala();
    if (typeof ResizeObserver !== 'undefined' && this.marco) {
      this.observador = new ResizeObserver(() => this.zone.run(() => this.ajustarEscala()));
      this.observador.observe(this.marco.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.limpiarTemporizadores();
    this.observador?.disconnect();
  }

  // ============================ Geometría ============================

  readonly limites = computed(() => {
    const nodos = this.grafoS()?.nodes ?? [];
    if (nodos.length === 0) return { minX: 0, minY: 0, w: 400, h: 200 };
    const minX = Math.min(...nodos.map((n) => n.positionX)) - this.MARGEN;
    const minY = Math.min(...nodos.map((n) => n.positionY)) - this.MARGEN;
    const maxX = Math.max(...nodos.map((n) => n.positionX + this.ANCHO)) + this.MARGEN;
    const maxY = Math.max(...nodos.map((n) => n.positionY + this.ALTO)) + this.MARGEN + 40;
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  });

  /** Encaja el ancho del grafo en el marco, sin agrandar ni bajar de 0,6. */
  private ajustarEscala(): void {
    const el = this.marco?.nativeElement;
    if (!el) return;
    const w = this.limites().w;
    this.escala.set(Math.max(0.6, Math.min(1, (el.clientWidth - 8) / w)));
  }

  /** Puerto de salida en el borde inferior, repartido según cuántas salidas tiene el nodo. */
  private posPuerto(nodo: WorkflowNode, puerto: string): { x: number; y: number } {
    const salidas = (this.grafoS()?.edges ?? []).filter((e) => e.from === nodo.id).map((e) => e.sourcePort || 'NEXT');
    const unicas = [...new Set(salidas)];
    const i = Math.max(0, unicas.indexOf(puerto || 'NEXT'));
    const n = Math.max(1, unicas.length);
    return { x: nodo.positionX + (this.ANCHO * (i + 1)) / (n + 1), y: nodo.positionY + this.ALTO };
  }

  readonly lineas = computed<Linea[]>(() => {
    const g = this.grafoS();
    if (!g) return [];
    const porId = new Map(g.nodes.map((n) => [n.id, n]));
    const r: Linea[] = [];
    for (const e of g.edges) {
      const a = porId.get(e.from);
      const b = porId.get(e.to);
      if (!a || !b) continue;
      const p1 = this.posPuerto(a, e.sourcePort);
      const x2 = b.positionX + this.ANCHO / 2;
      const y2 = b.positionY;
      const d = Math.max(36, Math.abs(y2 - p1.y) / 2);
      const cp: Linea['p'] = [p1.x, p1.y, p1.x, p1.y + d, x2, y2 - d, x2, y2];
      r.push({
        clave: `${e.from}>${e.to}>${e.sourcePort}`,
        from: e.from,
        to: e.to,
        path: `M ${cp[0]} ${cp[1]} C ${cp[2]} ${cp[3]}, ${cp[4]} ${cp[5]}, ${cp[6]} ${cp[7]}`,
        etiqueta: !e.sourcePort || e.sourcePort === 'NEXT' ? null : e.sourcePort,
        lx: (p1.x + x2) / 2,
        ly: (p1.y + y2) / 2,
        p: cp,
        color: this.colorDe(a.type),
      });
    }
    return r;
  });

  /**
   * Un marcador de punta por cada color distinto: los marcadores SVG no heredan
   * el color del trazo al que se enganchan, así que cada color necesita el suyo.
   */
  readonly marcasLineas = computed(() => {
    const vistos = new Map<string, string>();
    for (const l of this.lineas()) if (!vistos.has(l.color)) vistos.set(l.color, this.idColor(l.color));
    return [...vistos].map(([color, id]) => ({ id, color }));
  });

  /** Identificador de marcador para un color (#16a34a → 16a34a; el '#' rompe la url()). */
  idColor(color: string): string {
    return color.replace('#', '');
  }

  /**
   * Texto legible sobre el color dado (blanco o tinta): los colores de la paleta
   * van del verde al ámbar, y sobre el ámbar el blanco no llega a 4,5:1.
   */
  contraste(color: string): string {
    const hex = color.replace('#', '');
    if (hex.length !== 6) return '#ffffff';
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const y =
      0.2126 * canal(parseInt(hex.slice(0, 2), 16)) +
      0.7152 * canal(parseInt(hex.slice(2, 4), 16)) +
      0.0722 * canal(parseInt(hex.slice(4, 6), 16));
    return y > 0.179 ? '#0f172a' : '#ffffff';
  }

  private lineaEntre(from: string, to: string): Linea | undefined {
    return this.lineas().find((l) => l.from === from && l.to === to);
  }

  // ============================ Estado derivado ============================

  /** Último estado conocido de cada nodo según lo ya reproducido. */
  readonly estados = computed(() => {
    const mapa = new Map<string, EstadoNodo>();
    const pasos = this.pasosS();
    const hechos = this.resueltos();
    for (let i = 0; i < hechos && i < pasos.length; i++) {
      mapa.set(pasos[i].nodeId, pasos[i].estado === 'ERROR' ? 'ERROR' : 'COMPLETADO');
    }
    const fase = this.fase();
    const actual = pasos[this.indice()];
    if (actual && fase === 'ejecutando') mapa.set(actual.nodeId, 'EJECUTANDO');
    if (fase === 'terminado') {
      const fin = this.finS();
      const ultimo = pasos[pasos.length - 1];
      if (ultimo && fin && (fin.estado === 'ESPERANDO' || fin.estado === 'APROBACION') && mapa.get(ultimo.nodeId) !== 'ERROR') {
        mapa.set(ultimo.nodeId, 'PAUSA');
      }
      for (const n of this.grafoS()?.nodes ?? []) if (!mapa.has(n.id)) mapa.set(n.id, 'NO_VISITADO');
    }
    return mapa;
  });

  estadoDe(id: string): EstadoNodo {
    return this.estados().get(id) ?? 'PENDIENTE';
  }

  /** Conectores recorridos: entre pasos consecutivos ya empezados. */
  readonly tomadas = computed(() => {
    const set = new Set<string>();
    const pasos = this.pasosS();
    const hasta = this.fase() === 'viajando' || this.fase() === 'ejecutando' ? this.indice() : this.resueltos() - 1;
    for (let i = 0; i < hasta && i + 1 < pasos.length; i++) {
      const l = this.lineaEntre(pasos[i].nodeId, pasos[i + 1].nodeId);
      if (l) set.add(l.clave);
    }
    return set;
  });

  /** El último paso resuelto de cada nodo, para su chip y su motivo de error. */
  readonly pasoPorNodo = computed(() => {
    const mapa = new Map<string, PasoAnimable>();
    const pasos = this.pasosS();
    for (let i = 0; i < this.resueltos() && i < pasos.length; i++) mapa.set(pasos[i].nodeId, pasos[i]);
    return mapa;
  });

  readonly pasoActual = computed(() => this.pasosS()[this.indice()] ?? null);

  /** Pasos visibles en la línea de tiempo: los resueltos y el que se está animando. */
  readonly pasosVisibles = computed(() => {
    const n = this.fase() === 'viajando' || this.fase() === 'ejecutando' ? this.indice() + 1 : this.resueltos();
    return this.pasosS().slice(0, n);
  });

  readonly enVivo = computed(() => this.modo === 'vivo' && !this.finS());

  readonly terminado = computed(() => this.fase() === 'terminado');

  /**
   * El reproductor se quedó sin nada que hacer hasta que lleguen datos: no hay
   * más pasos, o el paso actual sigue EJECUTANDO (NEXA pensando de verdad).
   * Al principio vale true para arrancar con los primeros pasos.
   */
  private esperandoDatos = true;

  // ============================ Reproductor ============================

  private limpiarTemporizadores(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = undefined;
    if (this.marcoRaf) cancelAnimationFrame(this.marcoRaf);
    this.marcoRaf = undefined;
    this.punto.set(null);
    this.colorPunto.set(null);
  }

  private programar(fn: () => void, ms: number): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(fn, ms / this.velocidad());
  }

  /** Da el siguiente paso de la reproducción. */
  private avanzar(): void {
    if (this.pausado()) return;
    const pasos = this.pasosS();
    const i = this.indice();

    if (i >= pasos.length) {
      if (this.finS()) {
        this.resueltos.set(pasos.length);
        this.fase.set('terminado');
      } else {
        // Faltan datos: el SSE o la próxima consulta traerán el siguiente paso.
        this.fase.set('esperando');
        this.esperandoDatos = true;
      }
      return;
    }

    const paso = pasos[i];
    const previo = pasos[i - 1];
    const linea = previo ? this.lineaEntre(previo.nodeId, paso.nodeId) : undefined;

    if (this.fase() !== 'ejecutando' && linea && !this.reducido) {
      this.fase.set('viajando');
      this.viajar(linea, 380, () => this.ejecutar());
    } else {
      this.ejecutar();
    }
  }

  private ejecutar(): void {
    const paso = this.pasoActual();
    if (!paso) return;
    this.fase.set('ejecutando');
    this.seguirNodo(paso.nodeId);
    if (paso.estado === 'EJECUTANDO') {
      // El motor sigue con este nodo de verdad: ngOnChanges retomará al llegar su fin.
      this.esperandoDatos = true;
      return;
    }
    const real = paso.duracionMs ?? 0;
    const espera = Math.min(1100, Math.max(450, real));
    this.programar(() => this.resolver(), espera);
  }

  private resolver(): void {
    const i = this.indice();
    this.resueltos.set(i + 1);
    this.indice.set(i + 1);
    this.fase.set('resuelto');
    this.programar(() => this.avanzar(), this.pasosS()[i]?.estado === 'ERROR' ? 500 : 200);
  }

  /** Mueve el punto por la curva del conector con requestAnimationFrame. */
  private viajar(l: Linea, ms: number, listo: () => void): void {
    const dur = ms / this.velocidad();
    const t0 = performance.now();
    const [x0, y0, x1, y1, x2, y2, x3, y3] = l.p;
    this.colorPunto.set(l.color);
    // Curva ease-in-out (la misma de --ease-in-out, aproximada): arranca y frena suave.
    const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const paso = (ahora: number) => {
      const t = suavizar(Math.min(1, (ahora - t0) / dur));
      const u = 1 - t;
      this.punto.set({
        x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      });
      if (t < 1) {
        this.marcoRaf = requestAnimationFrame(paso);
      } else {
        this.marcoRaf = undefined;
        this.punto.set(null);
        this.colorPunto.set(null);
        listo();
      }
    };
    this.marcoRaf = requestAnimationFrame(paso);
  }

  /** Desplaza el marco con suavidad si el nodo activo queda fuera de la vista. */
  private seguirNodo(id: string): void {
    const el = this.marco?.nativeElement;
    const n = this.grafoS()?.nodes.find((x) => x.id === id);
    if (!el || !n) return;
    const z = this.escala();
    const { minX, minY } = this.limites();
    const cx = (n.positionX - minX + this.ANCHO / 2) * z;
    const cy = (n.positionY - minY + this.ALTO / 2) * z;
    const fuera =
      cx < el.scrollLeft + el.clientWidth * 0.15 || cx > el.scrollLeft + el.clientWidth * 0.85 ||
      cy < el.scrollTop + el.clientHeight * 0.2 || cy > el.scrollTop + el.clientHeight * 0.8;
    if (!fuera) return;
    el.scrollTo({
      left: Math.max(0, cx - el.clientWidth / 2),
      top: Math.max(0, cy - el.clientHeight / 2),
      behavior: this.reducido ? 'auto' : 'smooth',
    });
  }

  // ============================ Controles ============================

  alternarPausa(): void {
    if (this.terminado()) {
      this.reiniciar();
      return;
    }
    const pausar = !this.pausado();
    this.pausado.set(pausar);
    if (pausar) {
      this.limpiarTemporizadores();
      // Un viaje a medias se descarta: al reanudar, el paso empieza a ejecutarse.
      if (this.fase() === 'viajando') this.fase.set('ejecutando');
    } else if (this.fase() === 'ejecutando') {
      this.esperandoDatos = false;
      this.ejecutar();
    } else {
      this.esperandoDatos = false;
      this.avanzar();
    }
  }

  reiniciar(): void {
    this.limpiarTemporizadores();
    this.indice.set(0);
    this.resueltos.set(0);
    this.fase.set('parado');
    this.pausado.set(false);
    this.esperandoDatos = false;
    this.marco?.nativeElement.scrollTo({ left: 0, top: 0 });
    this.programar(() => this.avanzar(), 250);
  }

  cambiarVelocidad(): void {
    this.velocidad.set(this.velocidad() === 1 ? 2 : 1);
  }

  /** Muestra el resultado final sin animar lo que falta. */
  saltarAlFinal(): void {
    this.limpiarTemporizadores();
    const n = this.pasosS().length;
    this.indice.set(n);
    this.resueltos.set(n);
    this.pausado.set(false);
    this.fase.set(this.finS() ? 'terminado' : 'esperando');
    this.esperandoDatos = !this.finS();
  }

  /** Lleva la reproducción a un paso concreto y la deja en pausa ahí. */
  irAPaso(i: number): void {
    this.limpiarTemporizadores();
    this.indice.set(i + 1);
    this.resueltos.set(i + 1);
    this.pausado.set(true);
    this.esperandoDatos = false;
    this.fase.set('resuelto');
    const p = this.pasosS()[i];
    if (p) this.seguirNodo(p.nodeId);
  }

  // ============================ Presentación ============================

  colorDe(tipo: string): string {
    return COLORES[tipo] ?? '#2563eb';
  }

  iconoDe(tipo: string): string {
    return ICONOS[tipo] ?? 'fa-solid fa-circle';
  }

  nombreDe(id: string): string {
    return this.grafoS()?.nodes.find((n) => n.id === id)?.name ?? id;
  }

  /** Resultado corto del paso, para el chip del nodo ("CRÍTICA · 95%", "2 avisados"). */
  chip(p: PasoAnimable | undefined | null): string | null {
    if (!p || p.estado === 'ERROR') return null;
    const nodos = (p.salida?.['nodos'] ?? {}) as Record<string, Record<string, unknown>>;
    const s = nodos[p.nodeId] ?? {};
    const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
    switch (p.nodeType) {
      case 'NEXA': {
        const base = texto(s['prioridad']) ?? texto(s['categoria']) ?? (s['texto'] ? 'Texto listo' : null);
        const c = Number(s['confianza']);
        const pct = Number.isFinite(c) && s['confianza'] !== undefined ? ` · ${Math.round(c > 1 ? c : c * 100)}%` : '';
        return base ? `${base}${pct}` : 'Analizado';
      }
      case 'IF':
      case 'SWITCH':
        return p.puerto && p.puerto !== 'NEXT' ? p.puerto : null;
      case 'NOTIFY': {
        const a = s['avisados'];
        const n = Array.isArray(a) ? a.length : Number(a);
        return Number.isFinite(n) ? `${n} ${n === 1 ? 'avisado' : 'avisados'}` : 'Enviado';
      }
      case 'EMAIL':
        return 'Correo enviado';
      case 'TICKET_ASSIGN_TEAM':
        return texto(s['agente']) ? `→ ${s['agente']}` : 'Equipo asignado';
      case 'TICKET_CREATE':
        return s['ticketNumero'] != null ? `Ticket #${s['ticketNumero']}` : texto(s['ticketId']) ? 'Ticket creado' : null;
      case 'TASK_CREATE':
        return texto(s['tareaId']) ? `Tarea #${s['tareaId']}` : null;
      case 'SLA_APPLY':
        return texto(s['politica']);
      case 'APPROVAL':
        return texto(s['decision']) ?? 'Pide aprobación';
      case 'WAIT':
        return 'En espera';
      default:
        return null;
    }
  }

  duracionTexto(ms: number | null): string {
    if (ms === null || ms === undefined) return '';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  /** Texto y tono de la tarjeta final. */
  readonly resumenFinal = computed(() => {
    const f = this.finS();
    if (!f) return null;
    const pasos = this.pasosS().length;
    switch (f.estado) {
      case 'COMPLETADO':
        return { tono: 'success', icono: 'fa-solid fa-circle-check', titulo: 'Ejecución completada', texto: `${pasos} ${pasos === 1 ? 'paso' : 'pasos'} sin errores.` };
      case 'ERROR':
        return { tono: 'error', icono: 'fa-solid fa-circle-xmark', titulo: 'La ejecución falló', texto: f.motivo ?? 'Revisa el paso marcado en rojo.' };
      case 'CANCELADO':
        return { tono: 'neutral', icono: 'fa-solid fa-ban', titulo: 'Ejecución cancelada', texto: f.motivo ?? '' };
      default:
        return { tono: 'warning', icono: 'fa-solid fa-hourglass-half', titulo: f.estado === 'APROBACION' ? 'Esperando aprobación' : 'En pausa', texto: f.motivo ?? 'Seguirá sola cuando se cumpla la condición.' };
    }
  });

  trackNodo(_: number, n: WorkflowNode): string {
    return n.id;
  }

  trackLinea(_: number, l: Linea): string {
    return l.clave;
  }

  trackMarca(_: number, m: { id: string; color: string }): string {
    return m.id;
  }

  trackPaso(_: number, p: PasoAnimable): number {
    return p.secuencia;
  }
}

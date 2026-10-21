import { TelefoniaService } from "../../../core/services/telefonia.service";
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription, firstValueFrom } from "rxjs";
import Quill from "quill";
import Swal from "sweetalert2";
import { AuthService } from "../../../core/services/auth.service";
import { AdminService, AgentOption } from "../../../core/services/admin.service";
import { TicketService } from "../../../core/services/ticket.service";
import { ToastService } from "../../../core/services/toast.service";
import { SseService } from "../../../core/services/sse.service";
import { QuickReplyService } from "../../../core/services/quick-reply.service";
import { QuickReply } from "../../../models/quick-reply.model";
import { BrowserNotificationService } from "../../../core/services/browser-notification.service";
import {
  SessionState,
  metaSesion,
  normalizarSesion,
} from "../../../core/utils/session-presence.util";
import {
  Ticket,
  Answer,
  Attach,
  AuditLog,
  Rating,
  TicketSla,
} from "../../../models/ticket.model";
import { duracionLegible } from "../../../core/utils/duracion.util";
import { SolicitanteResumen } from "../../../models/user.model";
import { Catalog } from "../../../models/user.model";
import { environment } from "../../../../environments/environment";
import { MasterOption } from "../../shared/components/master-select/master-select.component";

/** Mensajes que se piden en cada tanda al chat. */
const TAMANO_PAGINA_CHAT = 20;

/** Distancia al principio a partir de la cual se carga la página anterior. */
const UMBRAL_CARGA_ARRIBA = 120;

/** Pastilla de estado de un mensaje. `null` significa que no se pinta ninguna. */
interface EstadoMensaje {
  icono: string;
  clase: string;
  texto: string;
  titulo: string;
}

/** Criterios de la calificación (mismos nombres que RatingRequest del backend). */
type CriterioCalificacion =
  | "overallSatisfaction"
  | "requirementsMet"
  | "responseTimeRating"
  | "resolutionQuality"
  | "agentCommunication";

/** Eventos que cambian datos del ticket abierto (no el chat). */
const CAMBIOS_DEL_TICKET = new Set([
  "TICKET_STATUS_CHANGED",
  "TICKET_ASSIGNED",
  "TICKET_UPDATED",
  "TICKET_ATTACHMENT",
]);

@Component({
  selector: "app-ticket-detail",
  templateUrl: "./ticket-detail.component.html",
  styleUrls: ["./ticket-detail.component.css", "./ticket-detail-chat.css", "./ticket-detail-ficha.css"],
})
export class TicketDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  ticketId!: string;
  ticket?: Ticket;
  answers: Answer[] = [];
  /**
   * Mensajes que llegaron mientras el chat estaba abierto (SSE o enviados
   * aquí). Solo esos entran con animación: al abrir el ticket o subir a leer el
   * historial, nada se mueve.
   */
  readonly recienLlegados = new Set<string>();
  /** Mensajes llegados mientras se leía más arriba (píldora "N nuevos"). */
  nuevosSinVer = 0;

  // ---------------- Chat: citar, editar, buscar, no leídos, respuestas rápidas
  /** Minutos durante los que se puede editar o eliminar un mensaje propio (igual que el backend). */
  readonly MINUTOS_EDICION = 15;
  /** Mensaje al que se está respondiendo (se cita al enviar). */
  citando: Answer | null = null;
  /** Mensaje propio que se está corrigiendo en el editor. */
  editando: Answer | null = null;
  /** Primer mensaje que estaba sin leer al abrir el hilo: ahí va el separador. */
  primerSinLeer: string | null = null;
  private divisorCalculado = false;
  /** Se está arrastrando un archivo sobre la conversación. */
  arrastrando = false;
  private profundidadArrastre = 0;
  // Búsqueda dentro de la conversación
  busquedaAbierta = false;
  busqueda = "";
  buscandoTodo = false;
  coincidencias: string[] = [];
  coincidenciasSet = new Set<string>();
  coincidenciaActual = 0;
  // Respuestas rápidas
  respuestasRapidas: QuickReply[] = [];
  panelRapidas = false;
  filtroRapidas = "";
  private rapidasCargadas = false;
  /** El panel se abrió escribiendo "/" (se cierra solo al borrarlo). */
  private rapidasPorBarra = false;
  audit: AuditLog[] = [];
  agents: AgentOption[] = [];
  catalog: Catalog | null = null;

  /**
   * El hilo ya no lleva paginador: se carga por páginas hacia atrás al subir
   * el scroll, como en una conversación. `answersPage` es el índice de la
   * página cargada más reciente; al subir se pide la siguiente (más antigua).
   */
  answersPage = 0;
  totalRespuestas = 0;
  tienePaginasAnteriores = false;
  cargandoAnteriores = false;
  cargandoMensajesIniciales = true;


  /**
   * Contenedor con scroll del chat. Se necesita para dos cosas que no se
   * pueden hacer solo con la lista: detectar que se llegó arriba (y cargar la
   * página anterior) y medir la altura antes y después de prepender, para que
   * la vista no salte al insertar mensajes más antiguos.
   */
  @ViewChild("chatScroll") chatScrollRef?: ElementRef<HTMLElement>;
  statuses = [
    "NUEVO",
    "ASIGNADO",
    "EN_PROCESO",
    "RESUELTO",
    "CERRADO",
    "ESCALADO",
  ];
  message = new FormControl("");
  rating?: Rating;
  /** Llega true desde `?calificar=1`, el enlace del correo de calificación. */
  private calificarPendiente = false;
  /** Ya respondió el backend, para no abrir el diálogo antes de tiempo. */
  private ratingCargado = false;
  userRole = "";
  currentUserEmail = "";
  quill: Quill | null = null;
  attachments: Attach[] = [];
  /** Ids en descarga, para no repetir la peticion si le dan dos veces. */
  private descargando = new Set<string>();
  messageFiles: File[] = [];
  internalMessage = false;
  /** Adjuntos elegidos en la tarjeta de información, pendientes de "Subir". */
  adjuntosPorSubir: File[] = [];
  subiendoAdjuntos = false;
  ficha?: SolicitanteResumen;
  fichaAbierta = false;
  fichaCargando = false;
  /**
   * Datos de la ficha 360 ya preparados para pintar. Se calculan una vez al
   * cargarla (prepararFicha) y no en getters: el navbar fuerza detección de
   * cambios cada segundo y un getter devolvería arrays nuevos en cada vuelta.
   */
  fichaEstados: { estado: string; cantidad: number; pct: number }[] = [];
  fichaTendencia: { mes: string; valor: number; alto: number }[] = [];
  fichaSenales: { icono: string; texto: string; tono: "info" | "success" | "warning" | "error" }[] = [];
  toolbarOpen = false;
  /** true mientras el mensaje propio está volando al backend. */
  sending = false;
  private myUserEmail = "";

  private sseSub?: Subscription;
  /** Id del usuario en sesión, para no avisarle de los mensajes que él mismo envía. */
  private myUserId?: string;

  /** Nombre de quien está escribiendo ahora mismo en este ticket, si hay alguien. */
  typingName: string | null = null;
  private typingTimer?: ReturnType<typeof setTimeout>;
  private lastTypingSentAt = 0;
  private typingInFlight = false;

  /**
   * El backend emite TICKET_ANSWERED por SSE cuando alguien responde. Con eso el
   * chat se actualiza solo, sin pedirle al usuario que vuelva a entrar.
   */
  private listenLiveAnswers(): void {
    const userSub = this.authService.user$.subscribe(
      (u) => (this.myUserId = u?.idUser),
    );
    this.sseSub = new Subscription(() => userSub.unsubscribe());

    this.sseSub.add(
      this.sseService.ticketEvent$.subscribe((e) => {
        if (
          e.type === "TICKET_ANSWER_UPDATED" &&
          e.ticketId === this.ticketId &&
          !(this.myUserId && e.actorId === this.myUserId)
        ) {
          this.refrescarMensajes();
          return;
        }
        // Cambios del propio ticket hechos por otra persona (estado, agente,
        // prioridad, categoría, adjuntos): antes se ignoraban y había que salir y
        // volver a entrar para verlos.
        if (
          e.ticketId === this.ticketId &&
          CAMBIOS_DEL_TICKET.has(e.type) &&
          !(this.myUserId && e.actorId === this.myUserId)
        ) {
          this.refrescarTicketSilencioso(e);
          return;
        }
        if (e.type !== "TICKET_ANSWERED" || e.ticketId !== this.ticketId)
          return;

        // Si el mensaje es de esta misma persona, no hay nada que avisarle.
        if (this.myUserId && e.actorId === this.myUserId) return;

        // Se nota si estaba pegado al final ANTES de que llegue el mensaje: si
        // estaba leyendo historial, recargar todo le saltaría la vista. Cuando
        // estaba al final, la recarga deja el chat abajo, que es lo esperado.
        const estabaAlFinal = this.estaAlFinal();
        const chatALaVista = this.chatALaVista();
        this.cargarUltimaPaginaSilencioso((llegados) => {
          if (estabaAlFinal) {
            this.scrollChat(true);
          } else {
            this.nuevosSinVer += llegados;
          }
        });
        // Si se está mirando el final del chat, el propio mensaje entrando ya
        // es el aviso: el toast encima era ruido. Solo se avisa si no se ve.
        if (!estabaAlFinal || !chatALaVista) {
          const quien = e.actorName || "Alguien";
          this.toastService.info(
            `${quien} respondió el ticket #${this.ticket?.numberTicket ?? ""}`,
          );
        }
        this.browserNotif.show(
          `Respuesta en el ticket #${this.ticket?.numberTicket ?? ""}`,
          e.ticketTitle || "",
          this.ticketId,
        );
      }),
    );

    // Acuses de lectura. Alguien ha abierto el hilo y ha leído lo que escribimos,
    // así que el doble check tiene que ponerse azul sin recargar. Se vuelve a
    // pedir la última página en lugar de inventar el estado aquí: los contadores
    // y los nombres de "Leído por" los decide el servidor, no el cliente.
    this.sseSub.add(
      this.sseService.lectura$.subscribe((e) => {
        if (e.ticketId !== this.ticketId) return;
        this.cargarUltimaPaginaSilencioso();
      }),
    );

    // Indicador de "escribiendo": el backend ya lo reenvía a los demás
    // participantes del ticket, así que aquí solo se pinta lo que llega.
    this.sseSub.add(
      this.sseService.typing$.subscribe((e) => {
        if (e.ticketId !== this.ticketId) return;
        this.typingName = e.displayName || "Alguien";
        if (this.typingTimer) clearTimeout(this.typingTimer);
        // Si dejara de escribir sin enviar, el aviso se retira solo.
        this.typingTimer = setTimeout(() => (this.typingName = null), 4000);
      }),
    );
  }

  /**
   * Avisa de que se está escribiendo. Con throttle: el evento se manda como mucho
   * una vez cada 1,5 s, porque si se enviara en cada pulsación llenaría el SSE de
   * tráfico sin aportar nada (el receptor solo necesita saber que hay actividad).
   */
  onAnswerInput(): void {
    if (!this.ticketId) return;
    const ahora = Date.now();
    if (this.typingInFlight || ahora - this.lastTypingSentAt < 1500) return;
    this.lastTypingSentAt = ahora;
    this.typingInFlight = true;
    this.ticketService.notifyTyping(this.ticketId).subscribe({
      next: () => (this.typingInFlight = false),
      error: () => (this.typingInFlight = false),
    });
  }

  constructor(
    private route: ActivatedRoute,
    private ticketService: TicketService,
    private adminService: AdminService,
    private authService: AuthService,
    private toastService: ToastService,
    private sseService: SseService,
    private telefonia: TelefoniaService,
    private browserNotif: BrowserNotificationService,
    private quickReplyService: QuickReplyService,
    private router?: Router,
  ) {
    this.userRole = this.authService.getRole();
    this.currentUserEmail = this.authService.getEmail();
  }

  ngOnDestroy(): void {
    this.sseSub?.unsubscribe();
    if (this.relojSla) clearInterval(this.relojSla);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.quill) {
      // Quill 2 no declara destroy en sus tipos; algunas builds lo traen.
      const conDestroy = this.quill as unknown as { destroy?: () => void };
      if (typeof conDestroy.destroy === "function") {
        conDestroy.destroy();
      }
      this.quill = null;
    }
  }

  ngOnInit(): void {
    this.telefonia.habilitada().subscribe((h) => (this.telefoniaHabilitada = h));
    this.ticketId = this.route.snapshot.paramMap.get("id") ?? "";
    this.calificarPendiente =
      this.route.snapshot.queryParamMap.get("calificar") === "1";
    this.load();
    this.listenLiveAnswers();
    this.adminService.catalog().subscribe({
      next: (c) => (this.catalog = c),
      error: () => undefined,
    });
    if (
      this.canManage &&
      (this.userRole === "ADMIN" ||
        this.userRole === "SUPER_ADMIN" ||
        this.userRole === "AGENT")
    ) {
      this.adminService.agents().subscribe({ next: (a) => (this.agents = a) });
    }
  }

  meta(
    name: string,
    list?: { name: string; icon?: string; color?: string }[],
  ): { icon: string; color: string } {
    const item = list?.find((x) => x.name === name);
    return { icon: item?.icon || "", color: item?.color || "" };
  }

  /**
   * Opciones del selector de cambio de estado. Es un <select> nativo porque el
   * valor se manda al backend en el mismo clic, pero app-master-select mantiene
   * el mismo manejador (ngModelChange) y aporta el icono del maestro.
   */
  get statusOptions(): MasterOption[] {
    return this.statuses.map((name) => {
      const meta = this.statusMeta(name);
      return { value: name, label: name, icon: meta.icon, color: meta.color };
    });
  }

  /** Icono y color de la sede, del maestro de sedes (como el área). */
  sucursalMeta(id: string | null | undefined): { icon: string; color: string } {
    const s = (this.catalog?.sucursales || []).find((x) => x.id === id);
    return { icon: s?.icon || "fa-solid fa-location-dot", color: s?.color || "#0d9488" };
  }

  areaMeta(name: string): { icon: string; color: string } {
    return this.meta(name, this.catalog?.areas);
  }

  categoryMeta(name: string): { icon: string; color: string } {
    return this.meta(name, this.catalog?.categories);
  }

  typeMeta(name: string): { icon: string; color: string } {
    return this.meta(name, this.catalog?.ticketTypes);
  }

  statusMeta(name: string): { icon: string; color: string } {
    return this.meta(name, this.catalog?.statuses);
  }

  priorityMeta(name: string): { icon: string; color: string } {
    return this.meta(name, this.catalog?.priorities);
  }

  ngAfterViewInit(): void {
    this.initQuill();
  }

  private initQuill(): void {
    if (this.quill) return;
    const host = document.querySelector("#quillEditorDetail");
    if (!host) return;

    const quill = new Quill(host as HTMLElement, {
      theme: "snow",
      placeholder: "Escriba una respuesta... (puede incluir imágenes)",
      modules: {
        toolbar: {
          container: [
            [{ header: [false, 1, 2, 3] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["blockquote"],
            ["link", "image"],
            ["clean"],
          ],
          handlers: {
            image: () => this.onEditorImage(),
          },
        },
      },
    });

    this.quill = quill;
    quill.on("text-change", () => {
      this.message.setValue(quill.root.innerHTML);
      this.onAnswerInput();
      this.detectarBarraRapidas();
    });

    // Pegar un archivo que no es imagen (PDF, Excel...) lo adjunta. Las
    // imágenes se quedan como siempre: Quill las incrusta en el mensaje.
    quill.root.addEventListener(
      "paste",
      (ev: ClipboardEvent) => {
        const archivos = Array.from(ev.clipboardData?.files || []);
        const noImagenes = archivos.filter((f) => !f.type.startsWith("image/"));
        if (noImagenes.length) {
          ev.preventDefault();
          ev.stopPropagation();
          this.agregarArchivos(noImagenes);
        }
      },
      true,
    );

    // Mover la toolbar al wrapper
    const toolbarEl = host.parentElement?.querySelector(".ql-toolbar");
    const wrapper = host.closest(".ticket-editor-wrap");
    const editorLine = host.closest(".ticket-editor");
    if (toolbarEl && wrapper && editorLine) {
      wrapper.insertBefore(toolbarEl, editorLine.nextSibling);

      // ⭐ NUEVO: reemplazar los SVG por iconos FA
      this.replaceQuillIcons(toolbarEl as HTMLElement);
    }
  }

  onEditorImage(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const quill = this.quill;
        if (!quill) return;
        const range = quill.getSelection(true);
        const index = range ? range.index : quill.getLength();
        quill.insertEmbed(index, "image", e.target?.result, "user");
        quill.setSelection(index + 1, 0);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  /**
   * Vuelve a leer el ticket sin tocar el chat ni el editor: cabecera (estado,
   * agente, prioridad), historial y, si hace falta, adjuntos y calificación.
   */
  private refrescarTicketSilencioso(e: { type: string; actorName?: string; status?: string | null }): void {
    const estadoAntes = this.ticket?.status;
    this.ticketService.getById(this.ticketId).subscribe({
      next: (t) => {
        this.ticket = t;
        this.loadAudit();
        this.loadSla();
        if (e.type === "TICKET_ATTACHMENT") {
          this.loadAttachments();
        }
        if ((t.status === "RESUELTO" || t.status === "CERRADO") && t.status !== estadoAntes) {
          this.loadRating();
        }
        const quien = e.actorName || "Alguien";
        const texto =
          e.type === "TICKET_STATUS_CHANGED" && t.status !== estadoAntes
            ? `${quien} cambió el estado a ${t.status}`
            : e.type === "TICKET_ASSIGNED"
              ? `${quien} cambió el agente asignado`
              : e.type === "TICKET_ATTACHMENT"
                ? `${quien} añadió un adjunto`
                : `${quien} actualizó el ticket`;
        this.toastService.info(texto, `Ticket #${t.numberTicket ?? ""}`);
      },
      error: () => undefined,
    });
  }

  load(): void {
    // /tickets/43 o /tickets/%2343: la gente comparte el número visible. Se
    // traduce al uuid; antes el 400 dejaba la pantalla en "Cargando ticket...".
    const numero = /^#?(\d+)$/.exec(this.ticketId.trim())?.[1];
    if (numero) {
      this.ticketService.search({ keyword: numero, page: 0, size: 5 }).subscribe({
        next: (p) => {
          const t = (p?.content || []).find((x) => String(x.numberTicket) === numero);
          if (!t) {
            this.router?.navigate(["/404"], { replaceUrl: true });
            return;
          }
          this.ticketId = t.idTicket;
          this.router?.navigate(["/tickets", t.idTicket], { replaceUrl: true });
          this.load();
        },
        error: () => this.router?.navigate(["/404"], { replaceUrl: true }),
      });
      return;
    }
    this.ticketService.getById(this.ticketId).subscribe({
      next: (t) => {
        this.ticket = t;
        this.loadAnswers();
        this.loadAttachments();
        this.loadAudit();
        this.loadSla();
        if (t.status === "RESUELTO" || t.status === "CERRADO") {
          this.loadRating();
        }
        this.intentarCalificarDesdeEnlace();
        // El *ngIf="ticket" ya renderizó el editor: inicializar Quill ahora.
        setTimeout(() => this.initQuill());
      },
      error: (e) =>
        // Sin ticket la pantalla se quedaría cargando para siempre.
        this.router?.navigate([e?.status === 403 ? "/403" : "/404"], { replaceUrl: true }),
    });
  }

  /**
   * Carga la última página del hilo y deja el chat abajo, que es por donde se
   * empieza a leer. Los mensajes optimistas que aún no ha confirmado el backend
   * se conservan al final.
   */
  private loadAnswers(): void {
    this.cargandoMensajesIniciales = true;
    this.answersPage = 0;
    this.tienePaginasAnteriores = false;
    this.cargandoAnteriores = false;

    this.ticketService
      .answersPage(this.ticketId, 0, TAMANO_PAGINA_CHAT)
      .subscribe({
        next: (pagina) => {
          this.answers = [
            ...pagina.answers,
            ...this.answers.filter(
              (x) => x.state === "enviando" || x.state === "fallido",
            ),
          ];
          this.answersPage = 0;
          this.totalRespuestas = pagina.total;
          this.tienePaginasAnteriores = pagina.hasMore;
          this.cargandoMensajesIniciales = false;
          // El separador "Mensajes no leídos" se fija solo la primera vez que se
          // abre el hilo: después todo está leído y no debe moverse.
          if (!this.divisorCalculado) {
            this.divisorCalculado = true;
            this.primerSinLeer =
              pagina.answers.find((a) => a.unreadOnOpen)?.idAnswer ?? null;
            if (this.primerSinLeer) {
              this.scrollAlSeparador();
              return;
            }
          }
          this.scrollChat();
        },
        error: () => (this.cargandoMensajesIniciales = false),
      });
  }

  /**
   * Recarga la última página conservando las páginas ya cargadas hacia atrás y
   * sin enseñar el spinner de carga inicial.
   * <p>
   * Es lo que se usa cuando llega un mensaje por SSE: si se recargara todo
   * desde cero se perdería el historial que el usuario ya había subido a leer.
   */
  private cargarUltimaPaginaSilencioso(alTerminar?: (llegados: number) => void): void {
    this.ticketService
      .answersPage(this.ticketId, 0, TAMANO_PAGINA_CHAT)
      .subscribe({
        next: (pagina) => {
          const ids = new Set(this.answers.map((a) => a.idAnswer));
          const nuevos = pagina.answers.filter((a) => !ids.has(a.idAnswer));
          if (nuevos.length) {
            nuevos.forEach((a) => this.recienLlegados.add(a.idAnswer));
            this.answers = [...this.answers, ...nuevos];
          }
          this.totalRespuestas = pagina.total;
          alTerminar?.(nuevos.length);
        },
        error: () => alTerminar?.(0),
      });
  }

  /**
   * Al llegar cerca del principio del chat, carga la página anterior y la
   * coloca encima.
   * <p>
   * El detalle que hace que se vea bien: al insertar mensajes arriba, el
   * navegador mantiene la distancia respecto al fondo, así que la vista
   * saltaría de golpe. Se mide la altura antes y después de prepender y se
   * suma esa diferencia al scrollTop, dejando el mensaje que se estaba
   * leyendo exactamente donde estaba.
   */
  alDesplazarChat(): void {
    if (this.nuevosSinVer && this.estaAlFinal()) {
      this.nuevosSinVer = 0;
    }
    const el = this.chatScroll();
    if (!el || this.cargandoAnteriores || !this.tienePaginasAnteriores) {
      return;
    }
    // Con menos de 120 px arriba se considera que llegó al principio.
    if (el.scrollTop > UMBRAL_CARGA_ARRIBA) {
      return;
    }

    this.cargandoAnteriores = true;
    const alturaAntes = el.scrollHeight;
    const scrollAntes = el.scrollTop;
    const paginaAnterior = this.answersPage + 1;

    this.ticketService
      .answersPage(this.ticketId, paginaAnterior, TAMANO_PAGINA_CHAT)
      .subscribe({
        next: (pagina) => {
          const ids = new Set(this.answers.map((a) => a.idAnswer));
          const nuevos = pagina.answers.filter((a) => !ids.has(a.idAnswer));
          if (nuevos.length) {
            this.answers = [...nuevos, ...this.answers];
          }
          this.answersPage = paginaAnterior;
          this.tienePaginasAnteriores = pagina.hasMore;
          this.cargandoAnteriores = false;

          // Ajuste de la posición para que el contenido no salte.
          setTimeout(() => {
            const ahora = this.chatScroll();
            if (ahora) {
              ahora.scrollTop =
                scrollAntes + (ahora.scrollHeight - alturaAntes);
            }
          });
        },
        error: () => (this.cargandoAnteriores = false),
      });
  }

  private chatScroll(): HTMLElement | null {
    const ref = this.chatScrollRef;
    return ref ? ref.nativeElement : null;
  }

  /** `suave`: para un mensaje que llega, no para la carga inicial. */
  private scrollChat(suave = false): void {
    setTimeout(() => {
      const el = this.chatScroll();
      if (!el) return;
      const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ top: el.scrollHeight, behavior: suave && !reducir ? "smooth" : "auto" });
    });
  }

  irAlFinalDelChat(): void {
    this.nuevosSinVer = 0;
    this.scrollChat(true);
  }

  private scrollAlSeparador(): void {
    setTimeout(() => {
      const el = this.chatScroll();
      const sep = el?.querySelector<HTMLElement>("#chat-sin-leer");
      if (!el || !sep) {
        this.scrollChat();
        return;
      }
      el.scrollTop = Math.max(0, sep.offsetTop - 16);
    });
  }

  /**
   * Recarga la última página tras una edición o un borrado de otra persona:
   * sustituye los mensajes que cambiaron y quita los que ya no están.
   */
  private refrescarMensajes(): void {
    this.ticketService.answersPage(this.ticketId, 0, TAMANO_PAGINA_CHAT).subscribe({
      next: (pagina) => {
        if (!pagina.answers.length) return;
        const porId = new Map(pagina.answers.map((a) => [a.idAnswer, a]));
        const desde = pagina.answers[0].createdAtAnswer;
        this.answers = this.answers
          .filter((a) => a.state || a.createdAtAnswer < desde || porId.has(a.idAnswer))
          .map((a) => {
            const nueva = porId.get(a.idAnswer);
            return nueva ? { ...nueva, unreadOnOpen: a.unreadOnOpen } : a;
          });
        this.totalRespuestas = pagina.total;
      },
    });
  }

  // ---------------- Estado de lectura agrupado
  /**
   * El "Leído por…" se enseña solo al final de cada racha: si el siguiente
   * mensaje es de la misma persona y dice lo mismo, este no lo repite. Antes
   * salía debajo de cada burbuja y recargaba mucho el hilo.
   */
  estadoVisible(i: number): EstadoMensaje | null {
    const a = this.answers[i];
    if (!a) return null;
    const e = this.estadoMensaje(a);
    if (!e || a.state) return e;
    const sig = this.answers[i + 1];
    if (!sig || sig.user !== a.user || sig.state) return e;
    const es = this.estadoMensaje(sig);
    return es && es.texto === e.texto && es.titulo === e.titulo ? null : e;
  }

  // ---------------- Responder citando
  responder(a: Answer): void {
    this.editando = null;
    this.citando = a;
    setTimeout(() => this.quill?.focus());
  }

  cancelarCita(): void {
    this.citando = null;
  }

  /** Texto plano de un mensaje, sin la cita que pudiera llevar dentro. */
  extracto(a: Answer, max = 140): string {
    const div = document.createElement("div");
    div.innerHTML = a.messageAnswer || "";
    div.querySelectorAll("blockquote").forEach((b) => b.remove());
    const plano = (div.textContent || "").replace(/\s+/g, " ").trim();
    if (!plano) return div.querySelector("img") ? "Imagen" : "Mensaje";
    return plano.length > max ? plano.slice(0, max) + "…" : plano;
  }

  private citaHtml(a: Answer): string {
    return (
      `<blockquote><a href="#msg-${a.idAnswer}">${escaparHtml(this.authorLabel(a))}</a>` +
      `<br>${escaparHtml(this.extracto(a))}</blockquote>`
    );
  }

  /** Un clic en una cita lleva al mensaje original. */
  alPulsarEnChat(ev: MouseEvent): void {
    const enlace = (ev.target as HTMLElement)?.closest?.('a[href^="#msg-"]');
    if (!enlace) return;
    ev.preventDefault();
    const id = (enlace.getAttribute("href") || "").slice(5);
    if (id) void this.irAMensaje(id);
  }

  /** Lleva al mensaje (cargando las páginas anteriores si hace falta) y lo resalta. */
  async irAMensaje(id: string): Promise<void> {
    if (!this.answers.some((a) => a.idAnswer === id)) {
      await this.cargarTodo();
    }
    setTimeout(() => {
      const fila = document.getElementById("msg-" + id);
      if (!fila) {
        this.toastService.info("Ese mensaje ya no está en la conversación");
        return;
      }
      const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      fila.scrollIntoView({ block: "center", behavior: reducir ? "auto" : "smooth" });
      fila.classList.remove("chat-destello");
      void fila.offsetWidth;
      fila.classList.add("chat-destello");
      setTimeout(() => fila.classList.remove("chat-destello"), 1600);
    });
  }

  /** Carga todas las páginas anteriores (para buscar o ir a un mensaje antiguo). */
  private async cargarTodo(): Promise<void> {
    if (this.buscandoTodo) return;
    this.buscandoTodo = true;
    try {
      while (this.tienePaginasAnteriores) {
        const siguiente = this.answersPage + 1;
        const pagina = await firstValueFrom(
          this.ticketService.answersPage(this.ticketId, siguiente, TAMANO_PAGINA_CHAT),
        );
        const ids = new Set(this.answers.map((a) => a.idAnswer));
        const nuevos = pagina.answers.filter((a) => !ids.has(a.idAnswer));
        this.answers = [...nuevos, ...this.answers];
        this.answersPage = siguiente;
        this.tienePaginasAnteriores = pagina.hasMore;
      }
    } catch {
      this.toastService.error("No se pudieron cargar los mensajes anteriores");
    } finally {
      this.buscandoTodo = false;
    }
  }

  // ---------------- Editar / eliminar un mensaje propio
  puedeEditar(a: Answer): boolean {
    if (!this.isMine(a) || a.state || a.idAnswer.startsWith("tmp-")) return false;
    const creado = new Date(a.createdAtAnswer).getTime();
    return Number.isFinite(creado) && Date.now() - creado < this.MINUTOS_EDICION * 60_000;
  }

  editar(a: Answer): void {
    if (!this.quill) return;
    this.citando = null;
    this.editando = a;
    this.quill.setContents([]);
    this.quill.clipboard.dangerouslyPasteHTML(0, a.messageAnswer || "", "user");
    setTimeout(() => {
      this.quill?.focus();
      this.quill?.setSelection(this.quill.getLength(), 0);
    });
  }

  cancelarEdicion(): void {
    this.editando = null;
    this.message.setValue("");
    this.quill?.setContents([]);
  }

  private guardarEdicion(): void {
    const original = this.editando;
    const texto = (this.message.value || "").toString();
    if (!original || this.sending) return;
    if (!texto.replace(/<\/?[^>]+(>|$)/g, "").trim()) {
      this.toastService.warn("El mensaje no puede quedar vacío");
      return;
    }
    this.sending = true;
    this.ticketService.editAnswer(this.ticketId, original.idAnswer, texto).subscribe({
      next: (r) => {
        this.sending = false;
        this.answers = this.answers.map((a) =>
          a.idAnswer === original.idAnswer
            ? { ...a, messageAnswer: r.messageAnswer, editedAtAnswer: r.editedAtAnswer }
            : a,
        );
        this.cancelarEdicion();
        this.toastService.success("Mensaje editado");
      },
      error: (err) => {
        this.sending = false;
        this.toastService.error(err?.error?.message || "No se pudo editar el mensaje");
      },
    });
  }

  eliminarMensaje(a: Answer): void {
    void Swal.fire({
      title: "¿Eliminar este mensaje?",
      text: "Desaparece de la conversación para todos. Queda registrado en el historial del ticket.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
      focusCancel: true,
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.ticketService.deleteAnswer(this.ticketId, a.idAnswer).subscribe({
        next: () => {
          this.answers = this.answers.filter((x) => x.idAnswer !== a.idAnswer);
          this.totalRespuestas = Math.max(0, this.totalRespuestas - 1);
          if (this.editando?.idAnswer === a.idAnswer) this.cancelarEdicion();
          this.toastService.info("Mensaje eliminado");
        },
        error: (err) =>
          this.toastService.error(err?.error?.message || "No se pudo eliminar el mensaje"),
      });
    });
  }

  // ---------------- Buscar en la conversación
  alternarBusqueda(): void {
    this.busquedaAbierta = !this.busquedaAbierta;
    if (!this.busquedaAbierta) this.limpiarBusqueda();
    else setTimeout(() => document.getElementById("chat-buscar")?.focus());
  }

  limpiarBusqueda(): void {
    this.busqueda = "";
    this.coincidencias = [];
    this.coincidenciasSet = new Set();
    this.coincidenciaActual = 0;
  }

  async buscarEnChat(texto: string): Promise<void> {
    this.busqueda = texto;
    const q = normalizar(texto);
    if (q.length < 2) {
      this.coincidencias = [];
      this.coincidenciasSet = new Set();
      return;
    }
    await this.cargarTodo();
    if (normalizar(this.busqueda) !== q) return; // llegó otra búsqueda mientras tanto
    this.coincidencias = this.answers
      .filter((a) => !a.state && normalizar(this.extracto(a, 100000) + " " + this.authorLabel(a)).includes(q))
      .map((a) => a.idAnswer);
    this.coincidenciasSet = new Set(this.coincidencias);
    // Se empieza por la más reciente, que es la que suele buscarse.
    this.coincidenciaActual = this.coincidencias.length - 1;
    if (this.coincidencias.length) void this.irAMensaje(this.coincidencias[this.coincidenciaActual]);
  }

  moverCoincidencia(paso: number): void {
    const n = this.coincidencias.length;
    if (!n) return;
    this.coincidenciaActual = (this.coincidenciaActual + paso + n) % n;
    void this.irAMensaje(this.coincidencias[this.coincidenciaActual]);
  }

  // ---------------- Respuestas rápidas
  get esPersonal(): boolean {
    return ["AGENT", "ADMIN", "SUPER_ADMIN"].includes(this.userRole);
  }

  get esAdmin(): boolean {
    return this.userRole === "ADMIN" || this.userRole === "SUPER_ADMIN";
  }

  get rapidasFiltradas(): QuickReply[] {
    const q = normalizar(this.filtroRapidas);
    if (!q) return this.respuestasRapidas;
    return this.respuestasRapidas.filter((r) => normalizar(r.title + " " + r.content).includes(q));
  }

  alternarRapidas(): void {
    this.rapidasPorBarra = false;
    this.panelRapidas = !this.panelRapidas;
    this.filtroRapidas = "";
    if (this.panelRapidas) this.cargarRapidas();
  }

  private cargarRapidas(forzar = false): void {
    if (this.rapidasCargadas && !forzar) return;
    this.quickReplyService.listar().subscribe({
      next: (l) => {
        this.respuestasRapidas = l;
        this.rapidasCargadas = true;
      },
      error: () => this.toastService.error("No se pudieron cargar las respuestas rápidas"),
    });
  }

  /** Escribir "/" al principio del mensaje abre el panel y filtra por lo que sigue. */
  private detectarBarraRapidas(): void {
    if (!this.esPersonal || !this.quill || this.editando) return;
    const plano = this.quill.getText().replace(/\n$/, "");
    const enBarra = /^\/\S*$/.test(plano);
    if (enBarra) {
      this.rapidasPorBarra = true;
      this.panelRapidas = true;
      this.filtroRapidas = plano.slice(1);
      this.cargarRapidas();
    } else if (this.rapidasPorBarra) {
      this.rapidasPorBarra = false;
      this.panelRapidas = false;
    }
  }

  insertarRapida(r: QuickReply): void {
    const quill = this.quill;
    if (!quill) return;
    const html = textoAHtml(this.rellenarVariables(r.content));
    if (this.rapidasPorBarra) {
      quill.setContents([]);
      quill.clipboard.dangerouslyPasteHTML(0, html, "user");
    } else {
      const rango = quill.getSelection(true);
      quill.clipboard.dangerouslyPasteHTML(rango ? rango.index : quill.getLength(), html, "user");
    }
    this.panelRapidas = false;
    this.rapidasPorBarra = false;
    setTimeout(() => {
      quill.focus();
      quill.setSelection(quill.getLength(), 0);
    });
  }

  /** {solicitante}, {ticket} y {agente} se sustituyen al insertar. */
  private rellenarVariables(texto: string): string {
    const solicitante = this.ticket?.userDisplayName || this.ticket?.user || "";
    return texto
      .replace(/\{solicitante\}/gi, solicitante)
      .replace(/\{ticket\}/gi, this.ticket?.numberTicket ? `#${this.ticket.numberTicket}` : "")
      .replace(/\{agente\}/gi, this.currentUserName || "");
  }

  private get currentUserName(): string {
    return this.authService.getEmail();
  }

  async formularioRapida(r?: QuickReply): Promise<void> {
    const res = await Swal.fire({
      title: r ? "Editar respuesta rápida" : "Nueva respuesta rápida",
      html: `
        <div style="text-align:left;display:flex;flex-direction:column;gap:10px">
          <label style="font-size:12px;font-weight:600">Título
            <input id="qr-titulo" class="swal2-input" style="margin:4px 0 0;width:100%" maxlength="80"
              placeholder="Ej. Estamos revisando" value="${escaparHtml(r?.title || "")}">
          </label>
          <label style="font-size:12px;font-weight:600">Texto
            <textarea id="qr-texto" class="swal2-textarea" style="margin:4px 0 0;width:100%;min-height:120px"
              maxlength="5000" placeholder="Hola {solicitante}, estamos revisando el ticket {ticket}…">${escaparHtml(r?.content || "")}</textarea>
          </label>
          <p style="font-size:11px;opacity:.65;margin:0">
            Variables: <b>{solicitante}</b>, <b>{ticket}</b> y <b>{agente}</b> se rellenan al insertar.
          </p>
          ${
            this.esAdmin
              ? `<label style="font-size:13px;display:flex;gap:8px;align-items:center">
                   <input id="qr-compartida" type="checkbox" ${r?.shared ? "checked" : ""}>
                   Compartir con todo el personal
                 </label>`
              : ""
          }
        </div>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#062e86",
      reverseButtons: true,
      focusConfirm: false,
      preConfirm: () => {
        const pop = Swal.getPopup()!;
        const title = (pop.querySelector("#qr-titulo") as HTMLInputElement).value.trim();
        const content = (pop.querySelector("#qr-texto") as HTMLTextAreaElement).value.trim();
        const shared = !!(pop.querySelector("#qr-compartida") as HTMLInputElement | null)?.checked;
        if (!title || !content) {
          Swal.showValidationMessage("Escribe un título y un texto");
          return false;
        }
        return { title, content, shared };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    const peticion = r
      ? this.quickReplyService.actualizar(r.id, res.value)
      : this.quickReplyService.crear(res.value);
    peticion.subscribe({
      next: () => {
        this.toastService.success(r ? "Respuesta rápida actualizada" : "Respuesta rápida creada");
        this.cargarRapidas(true);
      },
      error: (e) => this.toastService.error(e?.error?.message || "No se pudo guardar"),
    });
  }

  eliminarRapida(r: QuickReply): void {
    void Swal.fire({
      title: `¿Eliminar "${escaparHtml(r.title)}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    }).then((x) => {
      if (!x.isConfirmed) return;
      this.quickReplyService.eliminar(r.id).subscribe({
        next: () => this.cargarRapidas(true),
        error: (e) => this.toastService.error(e?.error?.message || "No se pudo eliminar"),
      });
    });
  }

  /** ¿Se ve el área de mensajes en pantalla? (puede estar fuera, más abajo o arriba). */
  private chatALaVista(): boolean {
    const el = this.chatScroll();
    if (!el || document.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  trackAnswer(_: number, a: Answer): string {
    return a.idAnswer;
  }

  /**
   * Un mensaje "continúa" al anterior si es de la misma persona, del mismo tipo
   * (nota interna o no), del mismo día y con menos de 5 minutos de diferencia:
   * entonces no repite foto ni nombre, como en cualquier app de mensajería.
   */
  esContinuacion(i: number): boolean {
    if (i === 0) return false;
    const a = this.answers[i];
    const b = this.answers[i - 1];
    if (!a || !b || a.user !== b.user || !!a.internalAnswer !== !!b.internalAnswer) return false;
    if (this.separadorFecha(i)) return false;
    const ta = new Date(a.createdAtAnswer).getTime();
    const tb = new Date(b.createdAtAnswer).getTime();
    return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) < 5 * 60 * 1000;
  }

  /** "Hoy", "Ayer" o "lunes 6 de oct." cuando el mensaje empieza un día nuevo. */
  separadorFecha(i: number): string | null {
    const a = this.answers[i];
    if (!a) return null;
    const dia = new Date(a.createdAtAnswer);
    if (Number.isNaN(dia.getTime())) return null;
    if (i > 0) {
      const previo = new Date(this.answers[i - 1].createdAtAnswer);
      if (mismoDia(dia, previo)) return null;
    }
    return etiquetaDia(dia);
  }

  /**
   * ¿Estamos pegados al final? Se usa para decidir si un mensaje que llega por
   * SSE debe desplazar la vista hacia abajo: si el usuario está leyendo
   * historial, no se le interrumpe.
   */
  private estaAlFinal(): boolean {
    const el = this.chatScroll();
    if (!el) {
      return true;
    }
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  /** Reintenta un mensaje que falló al enviarse. */
  reintentar(a: Answer): void {
    const texto = a.messageAnswer || "";
    this.answers = this.answers.filter((x) => x.idAnswer !== a.idAnswer);
    this.message.setValue(texto);
    this.sendAnswer();
  }

  /** Descarta un mensaje que no llegó a enviarse. */
  descartar(a: Answer): void {
    this.answers = this.answers.filter((x) => x.idAnswer !== a.idAnswer);
  }

  private loadAttachments(): void {
    this.ticketService
      .attachments(this.ticketId)
      .subscribe({ next: (a) => (this.attachments = a) });
  }

  private loadAudit(): void {
    // El historial solo se muestra al personal: el solicitante no lo descarga.
    if (!this.canManage) return;
    this.ticketService
      .audit(this.ticketId)
      .subscribe({ next: (a) => (this.audit = a) });
  }

  /** Plazos del SLA de este ticket (vencimiento y cuenta regresiva). */
  sla: TicketSla | null = null;
  /** Hora de referencia de la cuenta regresiva; se refresca cada 30 s. */
  ahoraSla = Date.now();
  private relojSla?: ReturnType<typeof setInterval>;
  /**
   * Respuesta y resolución ya calculadas. Es una propiedad y no un getter: un
   * array nuevo en cada detección de cambios recrearía las filas sin parar.
   */
  plazosSla: {
    nombre: string;
    vence: string | null;
    estado: { texto: string; clase: string; icono: string } | null;
  }[] = [];

  private loadSla(): void {
    this.ticketService.sla(this.ticketId).subscribe({
      next: (s) => {
        this.sla = s;
        this.actualizarPlazosSla();
        if (s && !this.relojSla) {
          this.relojSla = setInterval(() => {
            this.ahoraSla = Date.now();
            this.actualizarPlazosSla();
          }, 30_000);
        }
      },
      error: () => {
        this.sla = null;
        this.plazosSla = [];
      },
    });
  }

  private actualizarPlazosSla(): void {
    const s = this.sla;
    this.plazosSla = !s
      ? []
      : [
          { nombre: "Respuesta", vence: s.respuestaVence,
            estado: this.plazoSla(s.respuestaVence, s.respondidoEn, s.respuestaVencida) },
          { nombre: "Resolución", vence: s.resolucionVence,
            estado: this.plazoSla(s.resolucionVence, s.resueltoEn, s.resolucionVencida) },
        ];
  }

  /**
   * Estado de un plazo para pintarlo: cumplido, vencido o cuánto falta.
   * Devuelve null si no hay plazo.
   */
  plazoSla(
    vence: string | null,
    cumplido: string | null,
    vencido: boolean,
  ): { texto: string; clase: string; icono: string } | null {
    if (!vence) return null;
    const limite = new Date(vence).getTime();
    if (cumplido) {
      const aTiempo = new Date(cumplido).getTime() <= limite;
      return aTiempo
        ? { texto: "Cumplido a tiempo", clase: "text-success", icono: "fa-solid fa-circle-check" }
        : { texto: "Cumplido fuera de plazo", clase: "text-error", icono: "fa-solid fa-circle-exclamation" };
    }
    const resta = (limite - this.ahoraSla) / 60_000;
    if (vencido || resta <= 0) {
      return {
        texto: `Venció hace ${duracionLegible(-resta)}`,
        clase: "text-error",
        icono: "fa-solid fa-triangle-exclamation",
      };
    }
    return {
      texto: `Vence en ${duracionLegible(resta)}`,
      clase: resta <= 120 ? "text-warning" : "text-base-content/70",
      icono: "fa-regular fa-hourglass-half",
    };
  }

  private loadRating(): void {
    this.ticketService.getRating(this.ticketId).subscribe({
      next: (r) => {
        this.rating = r;
        this.ratingCargado = true;
        this.intentarCalificarDesdeEnlace();
      },
      error: (err) => {
        // 404 = todavía no está calificado: es el caso normal, no un error. Antes
        // se trataba como fallo y ni el aviso ni el enlace "Califica tu
        // experiencia" del correo llegaban a ofrecer la calificación.
        if (err?.status === 404) {
          this.rating = undefined;
          this.ratingCargado = true;
          this.intentarCalificarDesdeEnlace();
          return;
        }
        // Sin saber si ya estaba calificado no se ofrece: mejor eso que permitir
        // una segunda calificación.
        this.calificarPendiente = false;
      },
    });
  }

  /**
   * Abre el diálogo de calificación si la URL trae `?calificar=1`.
   *
   * Es el destino del botón "Califica tu experiencia" de los correos, que se
   * construyó como `[urlCalificar]`. El ticket y la calificación se cargan por
   * separado, así que se espera a que lleguen los dos: abrir en cuanto llega el
   * ticket ofrecería calificar otra vez un ticket ya calificado.
   */
  private intentarCalificarDesdeEnlace(): void {
    if (!this.calificarPendiente || this.ticket == null) return;
    if (this.ticket.status !== "RESUELTO" && this.ticket.status !== "CERRADO") {
      this.calificarPendiente = false;
      this.toastService.info("Este ticket todavía no está listo para calificarse.");
      return;
    }
    if (!this.ratingCargado) return;
    if (this.rating != null) {
      this.calificarPendiente = false;
      this.toastService.info("Este ticket ya estaba calificado.");
      return;
    }
    if (!this.canRate) return;
    this.calificarPendiente = false;
    void this.rateTicket();
  }

  get canManage(): boolean {
    return (
      this.userRole === "ADMIN" ||
      this.userRole === "SUPER_ADMIN" ||
      this.userRole === "AGENT"
    );
  }

  /**
   * Califica quien abrió el ticket, sea cual sea su rol (antes solo el rol
   * USER: un jefe de área o alguien del personal no veía nunca el botón, aunque
   * el backend sí se lo permitía), y solo cuando está resuelto o cerrado.
   */
  get canRate(): boolean {
    return (
      !!this.myUserId &&
      this.ticket?.userId === this.myUserId &&
      (this.ticket?.status === "RESUELTO" ||
        this.ticket?.status === "CERRADO") &&
      this.ratingCargado &&
      !this.rating
    );
  }

  // ============================ Calificación ============================
  readonly criteriosCalificacion: { clave: CriterioCalificacion; titulo: string; ayuda: string }[] = [
    { clave: "overallSatisfaction", titulo: "Satisfacción general", ayuda: "¿Qué tan conforme quedó con la atención?" },
    { clave: "requirementsMet", titulo: "Se resolvió lo que pidió", ayuda: "¿Se cumplió lo que necesitaba?" },
    { clave: "responseTimeRating", titulo: "Tiempo de respuesta", ayuda: "¿Le atendieron a tiempo?" },
    { clave: "resolutionQuality", titulo: "Calidad de la solución", ayuda: "¿La solución fue buena y duradera?" },
    { clave: "agentCommunication", titulo: "Trato y comunicación", ayuda: "¿El agente fue claro y amable?" },
  ];
  readonly textoEstrellas = ["", "Muy mal", "Mal", "Regular", "Bien", "Excelente"];
  readonly unoACinco = [1, 2, 3, 4, 5];
  calificando = false;
  enviandoCalificacion = false;
  calif: Record<CriterioCalificacion, number> & { comentarios: string } = this.calificacionVacia();
  /** Estrella bajo el puntero, para previsualizar antes de hacer clic. */
  califHover: { clave: CriterioCalificacion; valor: number } | null = null;

  private calificacionVacia(): Record<CriterioCalificacion, number> & { comentarios: string } {
    return {
      overallSatisfaction: 0,
      requirementsMet: 0,
      responseTimeRating: 0,
      resolutionQuality: 0,
      agentCommunication: 0,
      comentarios: "",
    };
  }

  estrellaLlena(clave: CriterioCalificacion, n: number): boolean {
    const valor = this.califHover?.clave === clave ? this.califHover.valor : this.calif[clave];
    return n <= valor;
  }

  get calificacionCompleta(): boolean {
    return this.criteriosCalificacion.every((c) => this.calif[c.clave] > 0);
  }

  cerrarCalificacion(): void {
    if (!this.enviandoCalificacion) this.calificando = false;
  }

  enviarCalificacion(): void {
    if (!this.calificacionCompleta || this.enviandoCalificacion) return;
    this.enviandoCalificacion = true;
    this.ticketService
      .rate(this.ticketId, {
        requirementsMet: this.calif.requirementsMet,
        allRequirementsMet: this.calif.requirementsMet === 5,
        responseTimeRating: this.calif.responseTimeRating,
        resolutionQuality: this.calif.resolutionQuality,
        agentCommunication: this.calif.agentCommunication,
        overallSatisfaction: this.calif.overallSatisfaction,
        comments: this.calif.comentarios.trim(),
      })
      .subscribe({
        next: () => {
          this.enviandoCalificacion = false;
          this.calificando = false;
          this.loadRating();
          this.toastService.success("¡Gracias por calificar la atención!");
        },
        error: (err) => {
          this.enviandoCalificacion = false;
          this.toastService.error(err?.error?.message || "No se pudo guardar la calificación");
        },
      });
  }

  /** Valor de un criterio de la calificación guardada (para pintar sus estrellas). */
  valorCalificado(clave: CriterioCalificacion): number {
    return (this.rating?.[clave] as number | undefined) ?? 0;
  }

  toggleFicha(): void {
    this.fichaAbierta = !this.fichaAbierta;
    if (this.fichaAbierta && !this.ficha && this.ticket?.userId != null) {
      this.loadFicha();
    }
  }

  private loadFicha(): void {
    const uid = this.ticket?.userId;
    if (uid == null) return;
    this.fichaCargando = true;
    this.ticketService.solicitanteResumen(uid).subscribe({
      next: (r) => {
        this.ficha = r;
        this.prepararFicha();
        this.fichaCargando = false;
      },
      error: () => {
        this.fichaCargando = false;
        this.toastService.warn("No se pudo cargar la ficha 360°");
      },
    });
  }

  /** Estados (de más a menos), tendencia de 6 meses y señales para el agente. */
  private prepararFicha(): void {
    const f = this.ficha;
    if (!f) return;
    const total = Math.max(1, f.totalTickets || 0);
    this.fichaEstados = Object.entries(f.ticketsPorEstado || {})
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([estado, cantidad]) => ({ estado, cantidad, pct: (cantidad / total) * 100 }));

    const meses = this.fichaMeses();
    const valores = f.ticketsUltimos6Meses || [];
    const max = Math.max(1, ...valores);
    this.fichaTendencia = valores.map((valor, i) => ({
      mes: meses[i] ?? "",
      valor,
      // Un mínimo visible para que un mes con 1 ticket no parezca vacío.
      alto: valor ? Math.max(8, Math.round((valor / max) * 100)) : 0,
    }));

    const senales: TicketDetailComponent["fichaSenales"] = [];
    if (f.openTickets >= 3) {
      senales.push({ icono: "fa-solid fa-layer-group", texto: `Tiene ${f.openTickets} tickets abiertos a la vez`, tono: "warning" });
    }
    if (f.avgSatisfaction != null && f.avgSatisfaction < 3) {
      senales.push({ icono: "fa-solid fa-face-frown", texto: `Satisfacción baja: ${f.avgSatisfaction.toFixed(1)} de 5`, tono: "error" });
    } else if (f.avgSatisfaction != null && f.avgSatisfaction >= 4.5) {
      senales.push({ icono: "fa-solid fa-face-smile", texto: "Suele quedar muy satisfecho", tono: "success" });
    }
    if (f.totalTickets <= 1) {
      senales.push({ icono: "fa-solid fa-seedling", texto: "Es su primer ticket", tono: "info" });
    }
    const desde = f.solicitante?.createdAtUser ? new Date(f.solicitante.createdAtUser) : null;
    if (desde && Date.now() - desde.getTime() < 30 * 86_400_000) {
      senales.push({ icono: "fa-solid fa-user-plus", texto: "Usuario nuevo (menos de 30 días)", tono: "info" });
    }
    if (this.solicitanteTieneEstado() && !this.solicitanteActivo()) {
      senales.push({ icono: "fa-solid fa-user-slash", texto: "Su cuenta está deshabilitada", tono: "error" });
    }
    this.fichaSenales = senales;
  }

  /** Porcentaje de sus tickets que terminaron resueltos o cerrados. */
  tasaResolucion(): number {
    const f = this.ficha;
    if (!f?.totalTickets) return 0;
    return Math.round((f.resolvedTickets / f.totalTickets) * 100);
  }

  copiarCorreoSolicitante(): void {
    const correo = this.ficha?.solicitante?.corporateEmailUser;
    if (!correo || !navigator.clipboard) return;
    navigator.clipboard.writeText(correo).then(
      () => this.toastService.success("Correo copiado"),
      () => this.toastService.warn("No se pudo copiar el correo"),
    );
  }

  /** Enlace mailto con el número del ticket ya en el asunto. */
  mailtoSolicitante(): string {
    const correo = this.ficha?.solicitante?.corporateEmailUser || "";
    const asunto = encodeURIComponent(`Ticket #${this.ticket?.numberTicket ?? ""}`);
    return `mailto:${correo}?subject=${asunto}`;
  }

  /**
   * Enlace de llamada de Microsoft Teams al correo del solicitante. Abre Teams
   * (aplicación o web) con la llamada lista para iniciar; antes era un tel: que
   * solo funcionaba si la ficha tenía teléfono y el equipo sabía marcarlo.
   */
  // ============================ Telefonía (UCM) ============================
  telefoniaHabilitada = false;
  llamando = false;

  /**
   * Pide a la central que llame de la extensión del agente a la del
   * solicitante. Suena primero el teléfono del agente; al contestar, la central
   * marca al solicitante. Se sigue el estado unos segundos para avisar si el
   * puente o la central fallaron.
   */
  llamarPorExtension(): void {
    if (this.llamando || !this.ticketId) return;
    this.llamando = true;
    this.telefonia.llamarAlSolicitante(this.ticketId).subscribe({
      next: (l) => {
        this.toastService.info(`Conteste su teléfono (ext. ${l.origen}): la central llamará a la ext. ${l.destino}.`,
          "Llamando…");
        this.seguirLlamada(l.id, 0);
      },
      error: (e) => {
        this.llamando = false;
        this.toastService.error(e?.error?.message || "No se pudo iniciar la llamada");
      },
    });
  }

  private seguirLlamada(id: string, vuelta: number): void {
    if (vuelta >= 20) {
      this.llamando = false;
      return;
    }
    setTimeout(() => {
      this.telefonia.estado(id).subscribe({
        next: (l) => {
          if (l.estado === "REALIZADA") {
            this.llamando = false;
          } else if (l.estado === "ERROR" || l.estado === "VENCIDA") {
            this.llamando = false;
            this.toastService.error(l.error || "La central no pudo hacer la llamada", "Llamada no realizada");
          } else {
            this.seguirLlamada(id, vuelta + 1);
          }
        },
        error: () => (this.llamando = false),
      });
    }, 1500);
  }

  teamsLlamada(): string {
    const correo = this.ficha?.solicitante?.corporateEmailUser || "";
    return `https://teams.microsoft.com/l/call/0/0?users=${encodeURIComponent(correo)}`;
  }

  /** Rol en español para la ficha (antes salía el código: USER). */
  etiquetaRol(rol?: string | null): string {
    const nombres: Record<string, string> = {
      SUPER_ADMIN: "Super administrador",
      ADMIN: "Administrador",
      AGENT: "Agente",
      USER: "Usuario",
      AREA_MANAGER: "Jefe de área",
    };
    return (rol && nombres[rol]) || rol || "—";
  }

  trackTicketHistorial = (_: number, t: { idTicket: string }) => t.idTicket;
  trackEstadoFicha = (_: number, e: { estado: string }) => e.estado;
  trackMesFicha = (i: number) => i;
  trackSenal = (_: number, s: { texto: string }) => s.texto;

  solicitanteNombre(): string {
    const s = this.ficha?.solicitante;
    return s?.displayName || s?.corporateEmailUser || "Solicitante";
  }

  solicitanteInicial(): string {
    const email = this.ficha?.solicitante?.corporateEmailUser;
    return (email || "?").charAt(0).toUpperCase();
  }

  /** Agente actualmente asignado al ticket (para mostrarlo en el dropdown). */
  assignedAgent(): AgentOption | null {
    const email = this.ticket?.agent;
    if (!email) return null;
    return this.agents.find((a) => a.corporateEmailUser === email) ?? null;
  }

  agentPhoto(a: AgentOption | null): string | null {
    return this.resolverFoto(a?.photoUrl);
  }

  /** URLs de fotos que no cargaron (archivo ausente en el servidor). */
  private fotosRotas = new Set<string>();

  /**
   * URL absoluta de una foto, o null si no hay o ya falló. Sin esto, una foto
   * cuyo archivo no está en el servidor se pintaba como imagen rota en vez de
   * caer a la inicial.
   */
  private resolverFoto(url: string | null | undefined): string | null {
    if (!url) return null;
    const abs = /^https?:\/\//i.test(url) ? url : `${environment.apiUrl}${url}`;
    return this.fotosRotas.has(abs) ? null : abs;
  }

  /** (error) de las fotos: se recuerda y se muestra la inicial. */
  fotoRota(evento: Event): void {
    const src = (evento.target as HTMLImageElement | null)?.getAttribute('src');
    if (src) this.fotosRotas.add(src);
  }

  agentInitial(a: AgentOption | null): string {
    return (a?.corporateEmailUser || "?").charAt(0).toUpperCase();
  }

  agentLabel(a: AgentOption | null): string {
    return a?.displayName || a?.corporateEmailUser || "?";
  }

  assignAgent(agentId: string, event?: Event): void {
    this.assign(agentId);
    (event?.target as HTMLElement | null)?.blur();
  }

  solicitanteTieneEstado(): boolean {
    return !!this.ficha?.solicitante?.statusUser;
  }

  solicitanteActivo(): boolean {
    return this.ficha?.solicitante?.statusUser === "ACTIVE";
  }

  solicitanteEstadoLabel(): string {
    return this.solicitanteActivo() ? "Activo" : "Inactivo";
  }

  /**
   * Foto del solicitante en la información del ticket. Antes se usaba la ruta
   * tal cual ("/uploads/..."), sin el prefijo de la API: en producción apuntaba
   * a una dirección que no existe y la foto no salía.
   */
  fotoTicketSolicitante(): string | null {
    return this.resolverFoto(this.ticket?.userPhotoUrl);
  }

  solicitantePhoto(): string | null {
    // Mientras la ficha carga (o si no se pudo cargar) vale la del propio ticket.
    return this.resolverFoto(this.ficha?.solicitante?.photoUrl || this.ticket?.userPhotoUrl);
  }

  maximoTickets(): number {
    if (!this.ficha?.ticketsPorEstado) return 0;
    return Math.max(1, ...Object.values(this.ficha.ticketsPorEstado));
  }

  anchoEstado(): number {
    return this.maximoTickets();
  }

  /**
   * Estado de sesión del solicitante, distinto del estado de la cuenta
   * (solicitanteActivo), que dice si está habilitada y no si está conectada.
   */
  sesionSolicitante(): SessionState {
    return normalizarSesion(this.ficha?.solicitante?.sessionState);
  }

  sesionSolicitanteDot(): string {
    return metaSesion(this.ficha?.solicitante?.sessionState).dot;
  }

  sesionSolicitanteIcon(): string {
    return metaSesion(this.ficha?.solicitante?.sessionState).icon;
  }

  sesionSolicitanteLabel(): string {
    return metaSesion(this.ficha?.solicitante?.sessionState).label;
  }

  /** La cabecera del ticket no trae la ficha 360, usa el estado del propio recurso. */
  sesionTicketDot(): string {
    return metaSesion(this.ticket?.userSessionState).dot;
  }

  sesionTicketIcon(): string {
    return metaSesion(this.ticket?.userSessionState).icon;
  }

  sesionTicketLabel(): string {
    return metaSesion(this.ticket?.userSessionState).label;
  }

  maxTendencia(): number {
    return Math.max(1, ...(this.ficha?.ticketsUltimos6Meses || [0]));
  }

  fichaMeses(): string[] {
    const meses = [
      "ENE",
      "FEB",
      "MAR",
      "ABR",
      "MAY",
      "JUN",
      "JUL",
      "AGO",
      "SEP",
      "OCT",
      "NOV",
      "DIC",
    ];
    const out: string[] = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      out.push(meses[d.getMonth()]);
    }
    return out;
  }

  /** Alto de la barra de un mes. Antes devolvía width y las barras verticales no se veían. */
  estiloBarra(value: number): { height: string } {
    return { height: `${Math.round((value / this.maxTendencia()) * 100)}%` };
  }

  estadoColorEstado(key: string): string {
    switch (key) {
      case "NUEVO":
        return "bg-info";
      case "ASIGNADO":
        return "bg-secondary";
      case "EN_PROCESO":
        return "bg-warning";
      case "RESUELTO":
        return "bg-success";
      case "CERRADO":
        return "bg-neutral";
      case "ESCALADO":
        return "bg-error";
      default:
        return "bg-base-content/40";
    }
  }

  estadoTextEstado(key: string, count: number): string {
    const nombre = key || "SIN ESTADO";
    return `${nombre}: ${count}`;
  }

  get ticketFiles(): Attach[] {
    return this.attachments.filter((a) => !a.answerId);
  }

  get hasMessage(): boolean {
    const text = (this.message.value || "").toString();
    return !!(text && text.replace(/<\/?[^>]+(>|$)/g, "").trim());
  }

  /**
   * Compara dos correos de forma tolerante: Outlook no siempre devuelve la
   * direccion con el mismo uso de mayusculas con la que esta guardada en el
   * token, y una comparacion estricta dejaba mensajes propios marcados como
   * ajenos (que es justo lo que hacia aparecer "Sin leer" en el chat).
   */
  private mismoCorreo(
    a: string | null | undefined,
    b: string | null | undefined,
  ): boolean {
    const x = (a || "").trim().toLowerCase();
    const y = (b || "").trim().toLowerCase();
    return !!x && x === y;
  }

  isMine(a: Answer): boolean {
    return this.mismoCorreo(a.user, this.currentUserEmail);
  }

  authorLabel(a: Answer): string {
    const name = a.userDisplayName || a.user;
    if (this.isMine(a)) {
      return `Tú${a.userDisplayName ? " · " + a.userDisplayName : ""}`;
    }
    if (this.mismoCorreo(a.user, this.ticket?.user)) {
      return `${name} (Solicitante)`;
    }
    return `${name} (Agente)`;
  }

  avatarSrc(a: Answer): string | null {
    return this.resolverFoto(a.userPhotoUrl);
  }

  /**
   * Estado de entrega y lectura de un mensaje, como pastilla con icono, color
   * y texto, o null si en ese mensaje no hay nada que enseñar.
   * <p>
   * Hay dos modos distintos y no se deben mezclar:
   * <ul>
   *   <li><b>Con permiso para ver los acuses</b> ({@code readCount} con
   *       numero): se distinguen enviado y sin leer, leído por una persona y
   *       leído por varias.</li>
   *   <li><b>Sin permiso</b> ({@code readCount} en null, que es lo que llega
   *       cuando el administrador lo restringe al personal): el frontend no
   *       sabe cuantos han leido el mensaje, y no debe inventar un cero. Solo
   *       queda el dato propio del usuario, {@code readByMe}. Un mensaje suyo
   *       sale "Enviado", y uno de otra persona sale "Sin leer" mientras no lo
   *       haya abierto: en cuanto lo lee, la pastilla desaparece. Sin esto los
   *       mensajes del personal se quedaban en "Sin leer" para siempre.</li>
   * </ul>
   */
  estadoMensaje(a: Answer): EstadoMensaje | null {
    const mio = this.isMine(a);
    const nombres = a.readBy || [];

    if (a.state === "enviando") {
      return {
        icono: "fa-solid fa-spinner fa-spin",
        clase: "chat-estado chat-estado-enviando",
        texto: "Enviando",
        titulo: "Enviando el mensaje",
      };
    }
    if (a.state === "fallido") {
      return {
        icono: "fa-solid fa-triangle-exclamation",
        clase: "chat-estado chat-estado-fallido",
        texto: "No se envió",
        titulo: "El mensaje no se pudo enviar. Pulsa para reintentar.",
      };
    }

    if (a.readCount == null) {
      // Sin permiso para ver los acuses: solo el propio estado de lectura del
      // usuario es fiable, y es informacion sobre si mismo, no sobre terceros.
      if (mio) {
        return {
          icono: "fa-solid fa-check",
          clase: "chat-estado chat-estado-enviado",
          texto: "Enviado",
          titulo: "Enviado.",
        };
      }
      if (!a.readByMe) {
        return {
          icono: "fa-solid fa-envelope",
          clase: "chat-estado chat-estado-sin-leer",
          texto: "Sin leer",
          titulo: "Este mensaje todavía no se ha leído.",
        };
      }
      return null;
    }

    const leidos = a.readCount;
    if (leidos > 1) {
      return {
        icono: "fa-solid fa-check-double",
        clase: "chat-estado chat-estado-leido",
        texto: `Leído por ${leidos} personas`,
        titulo: "Leído por: " + nombres.join(", "),
      };
    }
    if (leidos === 1) {
      return {
        icono: "fa-solid fa-check-double",
        clase: "chat-estado chat-estado-leido",
        texto: `Leído por ${nombres[0] || "1 persona"}`,
        titulo: "Leído por: " + nombres.join(", "),
      };
    }
    // Nadie lo ha leído todavía. En un mensaje propio significa "salió y
    // todavía no lo ha abierto el destinatario", no que esté fallando: por eso
    // lleva un check y no un reloj.
    if (mio) {
      return {
        icono: "fa-solid fa-check",
        clase: "chat-estado chat-estado-enviado",
        texto: "Enviado",
        titulo: "Enviado. Todavía no lo ha leído nadie más.",
      };
    }
    return {
      icono: "fa-solid fa-envelope",
      clase: "chat-estado chat-estado-sin-leer",
      texto: "Sin leer",
      titulo: "Este mensaje todavía no se ha leído.",
    };
  }

  avatarInitial(a: Answer): string {
    const email = a.user && a.user.trim() ? a.user : a.userDisplayName || "";
    return email ? email.charAt(0).toUpperCase() : "?";
  }

  /**
   * Estado de sesión de quien escribió el mensaje.
   *
   * Antes solo miraba en `agents`, que contiene unicamente usuarios con rol
   * AGENT: los mensajes del solicitante salian siempre como "desconectado"
   * aunque estuviera en linea. Ahora se consulta tambien la ficha del
   * solicitante y, si el autor es el usuario con sesion, su propio estado.
   */
  sesionAutor(a: Answer): string {
    // El backend manda el estado de quien escribió cada mensaje. Antes se
    // deducía buscando el autor en `agents`, que solo contiene usuarios con rol
    // AGENT, o en la ficha del solicitante: un ADMIN o SUPER_ADMIN que
    // respondía no estaba en ninguna de las dos, así que al solicitante le
    // salía "Desconectado" aunque estuviera conectado. Se conserva el fallback
    // por si el backend fuese de una versión anterior y no mandara el campo.
    if (a.userSessionState) {
      return a.userSessionState;
    }

    const email = a.user?.trim();
    const delAgente = this.agents.find((x) => x.corporateEmailUser === email);
    if (delAgente) return delAgente.sessionState || "DESCONECTADO";

    if (email && email === this.ficha?.solicitante?.corporateEmailUser) {
      return this.ficha?.solicitante?.sessionState || "DESCONECTADO";
    }
    if (this.mismoCorreo(email, this.currentUserEmail)) {
      return this.sesionPropia;
    }
    if (this.mismoCorreo(email, this.ticket?.user)) {
      return this.ticket?.userSessionState || "DESCONECTADO";
    }
    return "DESCONECTADO";
  }

  /** Estado del usuario con sesión, para pintar su propio avatar. */
  get sesionPropia(): string {
    return this.ticket?.userSessionState || "DESCONECTADO";
  }

  /**
   * Color del punto de presencia. Los canales de daisyUI v4 (--su, --wa, --er)
   * no son colores por sí solos: hay que envolverlos en oklch() o el navegador
   * los descarta y el punto queda sin pintar.
   */
  sesionPunto(estado?: string | null): string {
    switch (estado) {
      case "EN_LINEA":
        return "oklch(var(--su))";
      case "RECIENTE":
        return "oklch(var(--wa))";
      default:
        return "oklch(var(--er))";
    }
  }

  /** Estado de sesión del agente asignado, buscado en la lista de agentes. */
  sesionAgente(): string {
    const a = this.agents.find(
      (x) => x.corporateEmailUser === this.ticket?.agent,
    );
    return a?.sessionState || "DESCONECTADO";
  }

  /** Foto del agente asignado, si la tiene. */
  agentAssignedPhoto(): string | null {
    const a = this.agents.find(
      (x) => x.corporateEmailUser === this.ticket?.agent,
    );
    return this.resolverFoto(a?.photoUrl);
  }

  /**
   * Contexto para el asistente IA flotante: descripción del ticket y TODO el hilo
   * de respuestas, para que sepa qué responder en esta página.
   */
  get aiContext(): string {
    if (!this.ticket) {
      return "";
    }
    const t = this.ticket;
    const sb = [
      `TICKET #${t.numberTicket}`,
      `Título: ${t.titleTicket}`,
      `Estado: ${t.status} · Prioridad: ${t.priority}`,
      `Solicitante: ${t.user}`,
      `Categoría: ${t.category}`,
      `Descripción: ${this.stripHtml(t.descriptionTicket)}`,
    ];
    if (this.answers?.length) {
      sb.push("", "Hilo completo de la conversación (en orden cronológico):");
      this.answers.forEach((a, i) => {
        sb.push(
          `${i + 1}. [${a.userDisplayName || a.user}] ${this.stripHtml(a.messageAnswer)}`,
        );
      });
    }
    return sb.join("\n");
  }

  private stripHtml(text: string): string {
    if (!text) return "";
    return String(text)
      .replace(/<\/?[^>]+(>|$)/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Descarga un adjunto.
   *
   * Pasa por HttpClient porque el endpoint exige sesión: un enlace plano no
   * lleva el token y se quedaría en un 401. Se pide como blob y se guarda con
   * un enlace temporal, que es la forma de forzar la descarga sin abrir una
   * pestaña que luego el navegador bloquearía al ser una respuesta binaria.
   */
  descargarAdjunto(a: Attach): void {
    if (!a.downloadUrl || this.descargando.has(a.idAttach)) {
      return;
    }
    this.descargando.add(a.idAttach);
    this.ticketService.downloadAttachment(this.ticketId, a.idAttach).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = a.fileNameAttach || "adjunto";
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Se libera despues de un turno para no cancelar la descarga en curso.
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.descargando.delete(a.idAttach);
      },
      error: () => {
        this.descargando.delete(a.idAttach);
        this.toastService.warn("No se pudo descargar el archivo");
      },
    });
  }

  estaDescargando(a: Attach): boolean {
    return this.descargando.has(a.idAttach);
  }

  messageFilesOf(answerId: string): Attach[] {
    return this.attachments.filter((a) => a.answerId === answerId);
  }

  /** Clase de la burbuja de un mensaje (asignado a la derecha del emisor). */
  bubbleClass(a: Answer): string {
    if (a.internalAnswer) {
      return "chat-message chat-message-internal bg-warning/15 text-base-content border border-warning/30 rounded-es-sm";
    }
    if (this.isMine(a)) {
      return "chat-message chat-message-user bg-primary/25 text-base-content border border-primary/40 rounded-ee-sm";
    }
    return "chat-message chat-message-other bg-base-200/70 text-base-content border border-base-300 rounded-es-sm";
  }

  /** Formatea el tamaño de un adjunto (bytes → B/KB/MB/...). */
  fileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  /** Extensión legible de un nombre de archivo. */
  fileExt(name: string): string {
    const ext = name.split(".").pop() || "";
    return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toUpperCase() : "ARCHIVO";
  }

  /** Ícono Font Awesome según el tipo de adjunto. */
  fileIcon(name: string): string {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext))
      return "fa-regular fa-image";
    if (["pdf"].includes(ext)) return "fa-regular fa-file-pdf";
    if (["doc", "docx"].includes(ext)) return "fa-regular fa-file-word";
    if (["xls", "xlsx", "csv"].includes(ext)) return "fa-regular fa-file-excel";
    if (["ppt", "pptx"].includes(ext)) return "fa-regular fa-file-powerpoint";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
      return "fa-regular fa-file-zipper";
    if (["mp3", "wav", "ogg", "m4a"].includes(ext))
      return "fa-regular fa-file-audio";
    if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext))
      return "fa-regular fa-file-video";
    return "fa-regular fa-file";
  }

  onMessageFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.agregarArchivos(Array.from(input.files || []));
    input.value = "";
  }

  /**
   * Suma archivos al mensaje (botón, arrastrar o pegar). Solo los tipos que el
   * backend acepta: rechazarlos aquí evita enviar y que falle después.
   */
  agregarArchivos(archivos: File[]): void {
    const validos: File[] = [];
    const rechazados: string[] = [];
    for (const f of archivos) {
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      if (EXTENSIONES_ADJUNTO.includes(ext)) validos.push(f);
      else rechazados.push(f.name);
    }
    const ya = new Set(this.messageFiles.map((f) => f.name + f.size));
    this.messageFiles = [
      ...this.messageFiles,
      ...validos.filter((f) => !ya.has(f.name + f.size)),
    ];
    if (rechazados.length) {
      this.toastService.warn(
        `No se admite: ${rechazados.join(", ")}. Formatos: imágenes, PDF, Office, TXT, CSV o ZIP.`,
      );
    }
  }

  // ---------------- Arrastrar y soltar archivos sobre la conversación
  alArrastrarEntra(ev: DragEvent): void {
    if (!this.llevaArchivos(ev)) return;
    ev.preventDefault();
    this.profundidadArrastre++;
    this.arrastrando = true;
  }

  alArrastrarSobre(ev: DragEvent): void {
    if (!this.llevaArchivos(ev)) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
  }

  alArrastrarSale(): void {
    this.profundidadArrastre = Math.max(0, this.profundidadArrastre - 1);
    if (this.profundidadArrastre === 0) this.arrastrando = false;
  }

  alSoltar(ev: DragEvent): void {
    if (!this.llevaArchivos(ev)) return;
    ev.preventDefault();
    this.profundidadArrastre = 0;
    this.arrastrando = false;
    this.agregarArchivos(Array.from(ev.dataTransfer?.files || []));
  }

  private llevaArchivos(ev: DragEvent): boolean {
    return !!ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes("Files");
  }

  removeMessageFile(i: number): void {
    this.messageFiles.splice(i, 1);
  }

  sendAnswer(): void {
    if (this.editando) {
      this.guardarEdicion();
      return;
    }
    const escrito = (this.message.value || "").toString();
    if (!escrito || !escrito.replace(/<\/?[^>]+(>|$)/g, "").trim()) return;
    if (this.sending) return;
    // La cita va dentro del propio mensaje, como un bloque enlazado al original:
    // así se conserva aunque el original se edite o se borre después.
    const text = this.citando ? this.citaHtml(this.citando) + escrito : escrito;
    this.citando = null;
    this.primerSinLeer = null;
    this.panelRapidas = false;
    const files = [...this.messageFiles];
    const internal = this.internalMessage && this.canManage;

    this.sending = true;
    // El mensaje se muestra de inmediato con estado "enviando" ySkeleton, y se
    // reemplaza por el real cuando el backend responde.
    const optimista: Answer = {
      idAnswer: `tmp-${Date.now()}`,
      messageAnswer: text,
      internalAnswer: internal,
      createdAtAnswer: new Date().toISOString(),
      user: this.currentUserEmail,
      state: "enviando",
    };
    this.recienLlegados.add(optimista.idAnswer);
    this.answers = [...this.answers, optimista];
    this.message.setValue("");
    if (this.quill) this.quill.setContents([]);
    this.messageFiles = [];
    this.internalMessage = false;
    this.toolbarOpen = false;
    this.scrollChat();

    this.ticketService
      .addAnswer(this.ticketId, { message: text, internal })
      .subscribe({
        next: (created) => {
          this.sending = false;
          this.answers = this.answers.filter(
            (a) => a.idAnswer !== optimista.idAnswer,
          );
          this.loadAnswers();
          this.loadAttachments();
          if (files.length) {
            this.uploadMessageFiles(files, created.idAnswer);
          }
        },
        error: (err) => {
          this.sending = false;
          // Se marca como fallido para que el usuario vea qué no salió y pueda reenviar.
          this.answers = this.answers.map((a) =>
            a.idAnswer === optimista.idAnswer
              ? { ...a, state: "fallido" as const }
              : a,
          );
          this.toastService.error(err?.error?.message || "No se pudo enviar");
        },
      });
  }

  private uploadMessageFiles(files: File[], answerId: string): void {
    files.forEach((f, i) => {
      setTimeout(
        () => {
          this.ticketService
            .uploadAttachment(this.ticketId, f, answerId)
            .subscribe({
              next: () => this.loadAttachments(),
              error: () =>
                this.toastService.warn(`No se pudo adjuntar ${f.name}`),
            });
        },
        i * 300 + 300,
      );
    });
  }

  changeStatus(statusName: string): void {
    this.ticketService.changeStatus(this.ticketId, statusName).subscribe({
      next: () => {
        this.load();
        this.toastService.success(`Estado: ${statusName}`);
      },
      error: (err) =>
        this.toastService.error(
          err?.error?.message || "No se pudo cambiar el estado",
        ),
    });
  }

  assign(agentId: string): void {
    this.ticketService.assign(this.ticketId, agentId).subscribe({
      next: () => {
        this.load();
        this.toastService.success("Ticket asignado");
      },
      error: (err) =>
        this.toastService.error(err?.error?.message || "No se pudo asignar"),
    });
  }

  /** Abre el formulario de calificación con estrellas. */
  async rateTicket(): Promise<void> {
    this.calif = this.calificacionVacia();
    this.califHover = null;
    this.calificando = true;
  }

  elegirAdjuntos(nuevos: File[]): void {
    const grandes = nuevos.filter((f) => f.size > 20 * 1024 * 1024);
    if (grandes.length) {
      this.toastService.warn(`Supera 20 MB y no se adjunta: ${grandes.map((f) => f.name).join(", ")}`);
    }
    const clave = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
    const ya = new Set(this.adjuntosPorSubir.map(clave));
    this.adjuntosPorSubir = [
      ...this.adjuntosPorSubir,
      ...nuevos.filter((f) => f.size <= 20 * 1024 * 1024 && !ya.has(clave(f))),
    ];
  }

  avisarAdjuntosRechazados(nombres: string[]): void {
    this.toastService.warn(`Tipo de archivo no permitido: ${nombres.join(", ")}`);
  }

  quitarAdjuntoPorSubir(i: number): void {
    this.adjuntosPorSubir = this.adjuntosPorSubir.filter((_, j) => j !== i);
  }

  /** Sube los elegidos de uno en uno; si alguno falla, se queda en la lista. */
  upload(): void {
    if (!this.adjuntosPorSubir.length || this.subiendoAdjuntos) return;
    const pendientes = [...this.adjuntosPorSubir];
    const fallidos: File[] = [];
    this.subiendoAdjuntos = true;
    const siguiente = (): void => {
      const f = pendientes.shift();
      if (!f) {
        this.subiendoAdjuntos = false;
        this.adjuntosPorSubir = fallidos;
        this.loadAttachments();
        if (!fallidos.length) this.toastService.success("Archivos subidos");
        return;
      }
      this.ticketService.uploadAttachment(this.ticketId, f).subscribe({
        next: () => siguiente(),
        error: (err) => {
          fallidos.push(f);
          this.toastService.error(err?.error?.message || `No se pudo subir ${f.name}`);
          siguiente();
        },
      });
    };
    siguiente();
  }

  /**
   * Reemplaza los iconos SVG nativos de Quill por iconos de Font Awesome
   * para que se vean correctamente con el tema de la app.
   */
  private replaceQuillIcons(toolbarEl: HTMLElement): void {
    const simpleIcons: Record<string, string> = {
      "ql-bold": "fa-bold",
      "ql-italic": "fa-italic",
      "ql-underline": "fa-underline",
      "ql-strike": "fa-strikethrough",
      "ql-blockquote": "fa-quote-right",
      "ql-link": "fa-link",
      "ql-image": "fa-image",
      "ql-clean": "fa-eraser",
    };
    const listIcons: Record<string, string> = {
      ordered: "fa-list-ol",
      bullet: "fa-list-ul",
    };

    // Botones simples
    toolbarEl.querySelectorAll("button").forEach((btn) => {
      let iconClass = "";

      // Caso especial: listas (se identifican por la clase + atributo value)
      if (btn.classList.contains("ql-list")) {
        const value = btn.getAttribute("value") || "";
        iconClass = listIcons[value] || "fa-list";
      } else {
        const classes = Array.from(btn.classList);
        for (const cls of classes) {
          if (simpleIcons[cls]) {
            iconClass = simpleIcons[cls];
            break;
          }
        }
      }

      if (!iconClass) return;

      // Reemplazar contenido por el icono FA
      btn.innerHTML = `<i class="fa-solid ${iconClass} text-sm leading-none" aria-hidden="true"></i>`;
    });

    // Picker de header (H1, H2, H3)
    const pickerLabel = toolbarEl.querySelector(".ql-header .ql-picker-label");
    if (pickerLabel) {
      pickerLabel.innerHTML = `<i class="fa-solid fa-heading text-sm leading-none" aria-hidden="true"></i>`;
    }
  }

  sesionSolicitanteColor(): string {
    switch (this.sesionSolicitante()) {
      case "EN_LINEA":
        return "#059669"; // success
      case "RECIENTE":
        return "#D97706"; // warning
      default:
        return "#DC2626"; // error
    }
  }
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_CORTOS = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Etiqueta del separador de día del chat (sin depender del locale de Angular). */
export function etiquetaDia(dia: Date, hoy: Date = new Date()): string {
  if (mismoDia(dia, hoy)) return "Hoy";
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(dia, ayer)) return "Ayer";
  const nombre = DIAS[dia.getDay()];
  // Solo la primera letra en mayúscula: "Jueves 1 de oct.", no "Jueves 1 De Oct.".
  const base = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${dia.getDate()} de ${MESES_CORTOS[dia.getMonth()]}`;
  return dia.getFullYear() === hoy.getFullYear() ? base : `${base} ${dia.getFullYear()}`;
}

/** Extensiones que admite el backend para un adjunto (igual que el accept del botón). */
const EXTENSIONES_ADJUNTO = [
  "png", "jpg", "jpeg", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx",
  "ppt", "pptx", "txt", "csv", "zip",
];

function escaparHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sin mayúsculas ni tildes, para buscar "atencion" y encontrar "Atención". */
function normalizar(t: string): string {
  return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Texto plano (de una respuesta rápida) a párrafos HTML para el editor. */
function textoAHtml(t: string): string {
  return t
    .split(/\n/)
    .map((l) => `<p>${l.trim() ? escaparHtml(l) : "<br>"}</p>`)
    .join("");
}

import { AfterViewChecked, AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import Quill from 'quill';
import { ProyectoService } from '../../../core/services/proyecto.service';
import { SseService } from '../../../core/services/sse.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { QuickReplyService } from '../../../core/services/quick-reply.service';
import { abrirBlob, tamanoLegible } from '../../../core/utils/abrir-blob.util';
import { urlFotoUsuario } from '../../../core/utils/user-photo.util';
import { ACCEPT_CHAT, AdjuntoMensaje, MensajeProyecto, ParticipanteChat } from '../../../models/proyecto.model';
import { QuickReply } from '../../../models/quick-reply.model';
import { confirmar } from '../../../core/utils/confirmar.util';

/**
 * Mención (@Nombre) como formato propio de Quill: un <mark class="chat-mencion">.
 * Antes iba en negrita con un color fijo en línea (#062e86) que en el tema oscuro
 * no se leía; con una clase, styles.css le da el color de cada tema.
 */
const Inline = Quill.import('blots/inline') as { new (...a: unknown[]): object; blotName?: string; tagName?: string; className?: string };
class MencionBlot extends Inline {
  static override blotName = 'mencion';
  // MARK y no SPAN: Quill 2 trata un <span> igual que su formato inline base y lo quitaba.
  static override tagName = 'mark';
  static override className = 'chat-mencion';
}
Quill.register(MencionBlot as never, true);

/** Quita tildes y pasa a minúsculas, para buscar sin importar cómo se escriba. */
function normalizar(t: string): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Texto plano → HTML seguro (respuestas rápidas y mensajes viejos sin formato). */
function textoAHtml(t: string): string {
  const esc = (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

/**
 * Chat grupal de un proyecto (V39), con las mismas herramientas que el chat de
 * los tickets: formato que se muestra u oculta ("Aa"), respuestas rápidas (rayo
 * o "/"), adjuntos (clip, arrastrar o pegar) y menciones con "@" que avisan a
 * esa persona (campana + correo, plantilla PROYECTO_MENCION). Enter envía;
 * Mayús+Enter salta de línea.
 */
@Component({
  selector: 'app-proyecto-chat',
  templateUrl: './proyecto-chat.component.html',
  styleUrls: ['./proyecto-chat.component.css'],
})
export class ProyectoChatComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  @Input({ required: true }) proyectoId!: string;
  /** El equipo escribe; el auditor (y quien solo sigue el proyecto) solo lee. */
  @Input() puedeEscribir = false;
  /** Por qué no se puede escribir (p. ej. proyecto terminado); null = el texto de siempre. */
  @Input() motivoSoloLectura: string | null = null;

  @ViewChild('lista') lista?: ElementRef<HTMLDivElement>;
  @ViewChild('editor') editorRef?: ElementRef<HTMLDivElement>;

  readonly accept = ACCEPT_CHAT;
  readonly maxArchivos = 5;
  readonly maxBytes = 10 * 1024 * 1024;
  mensajes: MensajeProyecto[] = [];
  cargando = true;
  hayMas = false;
  cargandoMas = false;
  archivos: File[] = [];
  enviando = false;
  arrastrando = false;
  /** Miniaturas de imágenes: se bajan una vez (blob) y se reutilizan. */
  miniaturas: Record<string, string> = {};
  /** Mensajes que llegaron en vivo (animación de llegada, como en tickets). */
  recienLlegados = new Set<string>();

  // ---- editor
  quill: Quill | null = null;
  /** Barra de formato visible ("Aa"). */
  barraFormato = false;
  hayTexto = false;
  formatos: Record<string, unknown> = {};

  // ---- respuestas rápidas (solo personal: agente, jefe o súper admin)
  readonly puedeRapidas: boolean;
  panelRapidas = false;
  rapidasPorBarra = false;
  filtroRapidas = '';
  respuestasRapidas: QuickReply[] = [];
  private rapidasCargadas = false;

  // ---- menciones
  participantes: ParticipanteChat[] = [];
  mencion: { inicio: number; texto: string } | null = null;
  mencionActiva = 0;
  /** Ids mencionados en el borrador (se confirman al enviar contra el texto). */
  private mencionados = new Map<string, string>();

  /** Mensaje al que se está respondiendo (cita) o que se está editando. */
  respondiendo: MensajeProyecto | null = null;
  editando: MensajeProyecto | null = null;
  /** Igual que en tickets: se edita o elimina durante los primeros 15 minutos. */
  readonly minutosEdicion = 15;

  private yo: string | undefined;
  private sub?: Subscription;
  private bajarAlFinal = false;
  private readonly tam = 50;

  constructor(
    private servicio: ProyectoService,
    private sse: SseService,
    private auth: AuthService,
    private toast: ToastService,
    private rapidas: QuickReplyService,
    private zone: NgZone,
  ) {
    this.puedeRapidas = ['AGENT', 'AREA_MANAGER', 'SUPER_ADMIN'].includes(this.auth.getRole());
  }

  ngOnInit(): void {
    this.yo = this.auth.currentUserSnapshot()?.idUser;
    this.servicio.chat(this.proyectoId, null, this.tam).subscribe({
      next: (l) => {
        this.mensajes = this.marcarPropios(l || []).reverse();
        this.hayMas = (l || []).length === this.tam;
        this.cargando = false;
        this.bajarAlFinal = true;
        this.cargarMiniaturas(this.mensajes);
        this.marcarLeido();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudo cargar el chat');
      },
    });
    if (this.puedeEscribir) this.cargarParticipantes();
    this.sub = this.sse.proyectoChat$.subscribe((m) => {
      if (m.proyectoId !== this.proyectoId) return;
      // Edición o eliminación de un mensaje que ya está en pantalla: se reemplaza.
      if (this.mensajes.some((x) => x.id === m.id)) {
        const [act] = this.marcarPropios([m]);
        this.mensajes = this.mensajes.map((x) => (x.id === m.id ? act : x));
        return;
      }
      const [nuevo] = this.marcarPropios([m]);
      this.recienLlegados.add(nuevo.id);
      this.mensajes = [...this.mensajes, nuevo];
      this.bajarAlFinal = true;
      this.cargarMiniaturas([nuevo]);
      if (!nuevo.propio) this.marcarLeido();
    });
  }

  ngAfterViewInit(): void {
    if (this.puedeEscribir) this.iniciarEditor();
  }

  ngAfterViewChecked(): void {
    if (this.bajarAlFinal && this.lista) {
      this.lista.nativeElement.scrollTop = this.lista.nativeElement.scrollHeight;
      this.bajarAlFinal = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    Object.values(this.miniaturas).forEach((u) => URL.revokeObjectURL(u));
  }

  // ---------------------------------------------------------------- editor

  private iniciarEditor(): void {
    const host = this.editorRef?.nativeElement;
    if (!host || this.quill) return;
    this.zone.runOutsideAngular(() => {
      const quill = new Quill(host, {
        placeholder: 'Escriba un mensaje… (@ para mencionar)',
        formats: ['bold', 'italic', 'underline', 'strike', 'list', 'blockquote', 'link', 'code-block', 'mencion'],
        modules: {
          toolbar: false,
          keyboard: {
            bindings: {
              // Con el menú de menciones abierto, Enter/Tab eligen a la persona.
              elegirMencion: {
                key: 'Enter',
                handler: () => {
                  if (!this.mencion || !this.mencionesFiltradas.length) return true;
                  this.zone.run(() => this.elegirMencion(this.mencionesFiltradas[this.mencionActiva]));
                  return false;
                },
              },
              tabMencion: {
                key: 'Tab',
                handler: () => {
                  if (!this.mencion || !this.mencionesFiltradas.length) return true;
                  this.zone.run(() => this.elegirMencion(this.mencionesFiltradas[this.mencionActiva]));
                  return false;
                },
              },
              arribaMencion: {
                key: 'ArrowUp',
                handler: () => {
                  if (!this.mencion) return true;
                  this.zone.run(() => (this.mencionActiva = Math.max(0, this.mencionActiva - 1)));
                  return false;
                },
              },
              abajoMencion: {
                key: 'ArrowDown',
                handler: () => {
                  if (!this.mencion) return true;
                  this.zone.run(() => (this.mencionActiva = Math.min(this.mencionesFiltradas.length - 1, this.mencionActiva + 1)));
                  return false;
                },
              },
              escapeMencion: {
                key: 'Escape',
                handler: () => {
                  if (!this.mencion && !this.panelRapidas && !this.respondiendo && !this.editando) return true;
                  this.zone.run(() => {
                    if (this.mencion || this.panelRapidas) { this.mencion = null; this.panelRapidas = false; }
                    else this.cancelarContexto();
                  });
                  return false;
                },
              },
              // Como cualquier chat: Enter envía, Mayús+Enter salta de línea.
              // Dentro de una lista o con las respuestas rápidas abiertas, Enter hace lo de siempre.
              enviarConEnter: {
                key: 'Enter',
                shiftKey: false,
                handler: (_r: unknown, contexto: { format?: Record<string, unknown> }) => {
                  if (this.panelRapidas || contexto?.format?.['list'] || contexto?.format?.['code-block']) return true;
                  this.zone.run(() => this.enviar());
                  return false;
                },
              },
            },
          },
        },
      });
      // Quill mueve el cursor DESPUÉS de avisar el cambio de texto: se mira en
      // el siguiente tick (si no, "@Is" no abría el menú de menciones).
      quill.on('text-change', () => setTimeout(() => this.zone.run(() => this.alCambiarTexto())));
      quill.on('selection-change', (r) => this.zone.run(() => {
        if (r) {
          this.formatos = quill.getFormat(r);
          this.detectarMencion();
        }
      }));
      quill.root.addEventListener('paste', (e: ClipboardEvent) => this.zone.run(() => this.pegar(e)), true);
      this.quill = quill;
    });
  }

  private alCambiarTexto(): void {
    const q = this.quill;
    if (!q) return;
    this.hayTexto = q.getText().trim().length > 0;
    const sel = q.getSelection();
    if (sel) this.formatos = q.getFormat(sel);
    this.detectarMencion();
    this.detectarBarraRapidas();
  }

  /** Activa o quita un formato (botones de la barra "Aa"). */
  formato(nombre: string, valor: unknown = true): void {
    const q = this.quill;
    if (!q) return;
    q.focus();
    const actual = q.getFormat()[nombre];
    q.format(nombre, actual === valor ? false : valor, 'user');
    this.formatos = q.getFormat();
  }

  enlace(): void {
    const q = this.quill;
    if (!q) return;
    const sel = q.getSelection(true);
    if (!sel || !sel.length) {
      this.toast.info('Seleccione el texto que llevará el enlace');
      return;
    }
    const url = window.prompt('Dirección del enlace (https://…)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      this.toast.error('El enlace debe empezar por http:// o https://');
      return;
    }
    q.format('link', url.trim(), 'user');
  }

  limpiarFormato(): void {
    const q = this.quill;
    if (!q) return;
    const sel = q.getSelection(true);
    if (sel) q.removeFormat(sel.index, Math.max(sel.length, 1), 'user');
  }

  activo(nombre: string, valor: unknown = true): boolean {
    return this.formatos[nombre] === valor;
  }

  // ---------------------------------------------------------------- menciones

  /** "@todos": avisa a todo el equipo del proyecto. */
  static readonly TODOS: ParticipanteChat = { id: '__todos__', nombre: 'todos', foto: null };

  private cargandoParticipantes = false;

  private cargarParticipantes(): void {
    if (this.cargandoParticipantes) return;
    this.cargandoParticipantes = true;
    this.servicio.participantesChat(this.proyectoId).subscribe({
      next: (p) => {
        this.participantes = (p || []).filter((x) => x.id !== this.yo);
        this.cargandoParticipantes = false;
        this.detectarMencion();
      },
      error: () => (this.cargandoParticipantes = false),
    });
  }

  get mencionesFiltradas(): ParticipanteChat[] {
    if (!this.mencion) return [];
    const q = normalizar(this.mencion.texto);
    const personas = this.participantes.filter((p) => normalizar(p.nombre).includes(q)).slice(0, 6);
    const todos = this.participantes.length > 0 && 'todos'.includes(q) ? [ProyectoChatComponent.TODOS] : [];
    return [...todos, ...personas];
  }

  /** "@ana" justo antes del cursor abre el menú; un espacio o salir de la palabra lo cierra. */
  private detectarMencion(): void {
    const q = this.quill;
    const sel = q?.getSelection();
    if (!q || !sel) {
      this.mencion = null;
      return;
    }
    const antes = q.getText(Math.max(0, sel.index - 40), Math.min(40, sel.index));
    const m = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(antes);
    if (!m) {
      this.mencion = null;
      return;
    }
    const texto = m[2];
    if (!this.mencion || this.mencion.texto !== texto) this.mencionActiva = 0;
    this.mencion = { inicio: sel.index - texto.length - 1, texto };
    // Si la lista no llegó (p. ej. el servidor se reinició), se pide otra vez.
    if (!this.participantes.length) this.cargarParticipantes();
  }

  elegirMencion(p: ParticipanteChat | undefined): void {
    const q = this.quill;
    if (!q || !p || !this.mencion) return;
    const { inicio, texto } = this.mencion;
    this.mencion = null;
    q.deleteText(inicio, texto.length + 1, 'user');
    const etiqueta = '@' + p.nombre;
    q.insertText(inicio, etiqueta, { mencion: true }, 'user');
    q.insertText(inicio + etiqueta.length, ' ', { mencion: false }, 'user');
    q.setSelection(inicio + etiqueta.length + 1, 0, 'user');
    // @todos = todos los participantes (el backend vuelve a filtrar).
    if (p.id === ProyectoChatComponent.TODOS.id) {
      this.participantes.forEach((x) => this.mencionados.set(x.id, etiqueta));
    } else {
      this.mencionados.set(p.id, etiqueta);
    }
  }

  fotoParticipante(p: ParticipanteChat): string | null {
    return urlFotoUsuario(p.foto);
  }

  // ---------------------------------------------------------------- respuestas rápidas

  get rapidasFiltradas(): QuickReply[] {
    const q = normalizar(this.filtroRapidas);
    return q ? this.respuestasRapidas.filter((r) => normalizar(r.title + ' ' + r.content).includes(q)) : this.respuestasRapidas;
  }

  alternarRapidas(): void {
    this.rapidasPorBarra = false;
    this.panelRapidas = !this.panelRapidas;
    this.filtroRapidas = '';
    if (this.panelRapidas) this.cargarRapidas();
  }

  private cargarRapidas(): void {
    if (this.rapidasCargadas) return;
    this.rapidas.listar().subscribe({
      next: (l) => {
        this.respuestasRapidas = l || [];
        this.rapidasCargadas = true;
      },
      error: () => this.toast.error('No se pudieron cargar las respuestas rápidas'),
    });
  }

  /** "/" al principio del mensaje abre el panel y filtra por lo que sigue. */
  private detectarBarraRapidas(): void {
    if (!this.puedeRapidas || !this.quill) return;
    const plano = this.quill.getText().replace(/\n$/, '');
    if (/^\/\S*$/.test(plano)) {
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
    const q = this.quill;
    if (!q) return;
    const html = textoAHtml(r.content.replace(/\{ticket\}|\{solicitante\}/gi, '').replace(/\{agente\}/gi, this.auth.getEmail() || ''));
    if (this.rapidasPorBarra) {
      q.setContents([] as never);
      q.clipboard.dangerouslyPasteHTML(0, html, 'user');
    } else {
      const sel = q.getSelection(true);
      q.clipboard.dangerouslyPasteHTML(sel ? sel.index : q.getLength(), html, 'user');
    }
    this.panelRapidas = false;
    this.rapidasPorBarra = false;
    setTimeout(() => { q.focus(); q.setSelection(q.getLength(), 0); });
  }

  // ---------------------------------------------------------------- envío

  get puedeEnviar(): boolean {
    return !this.enviando && (this.hayTexto || this.archivos.length > 0);
  }

  // ---------------------------------------------------------------- responder / editar / eliminar

  responder(m: MensajeProyecto): void {
    this.editando = null;
    this.respondiendo = m;
    setTimeout(() => this.quill?.focus());
  }

  puedeEditar(m: MensajeProyecto): boolean {
    if (!m.propio || m.eliminado || !this.puedeEscribir) return false;
    const t = new Date(m.creado).getTime();
    return Number.isFinite(t) && Date.now() - t < this.minutosEdicion * 60_000;
  }

  editar(m: MensajeProyecto): void {
    const q = this.quill;
    if (!q) return;
    this.respondiendo = null;
    this.editando = m;
    this.archivos = [];
    q.setContents([] as never);
    q.clipboard.dangerouslyPasteHTML(0, this.htmlDe(m), 'user');
    setTimeout(() => { q.focus(); q.setSelection(q.getLength(), 0); });
  }

  cancelarContexto(): void {
    if (this.editando) this.quill?.setContents([] as never);
    this.editando = null;
    this.respondiendo = null;
  }

  async eliminar(m: MensajeProyecto): Promise<void> {
    const ok = await confirmar({
      titulo: '¿Eliminar el mensaje?',
      texto: 'Todos verán "Se eliminó este mensaje" en su lugar.',
    });
    if (!ok) return;
    this.servicio.eliminarMensaje(this.proyectoId, m.id).subscribe({
      next: (v) => {
        const [act] = this.marcarPropios([v]);
        this.mensajes = this.mensajes.map((x) => (x.id === m.id ? act : x));
        if (this.editando?.id === m.id) this.cancelarContexto();
      },
      error: (e) => this.toast.error(e?.error?.message || 'No se pudo eliminar el mensaje'),
    });
  }

  /** Texto plano corto de un mensaje (barra "Respondiendo a"). */
  textoCorto(m: MensajeProyecto): string {
    const t = (m.texto || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (t) return t.length > 90 ? t.slice(0, 90) + '…' : t;
    return m.adjuntos.length ? 'Archivo adjunto' : '';
  }

  /** Salta al mensaje citado (si está cargado) y lo resalta un momento. */
  irACita(id: string): void {
    const el = document.getElementById('pm-' + id);
    if (!el) {
      this.toast.info('Ese mensaje es más antiguo: cargue los mensajes anteriores para verlo');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('chat-resaltado');
    setTimeout(() => el.classList.remove('chat-resaltado'), 1500);
  }

  private guardarEdicion(): void {
    const q = this.quill;
    const m = this.editando;
    if (!q || !m || this.enviando) return;
    if (!this.hayTexto) {
      this.toast.error('El mensaje no puede quedar vacío; si quiere quitarlo, elimínelo');
      return;
    }
    this.enviando = true;
    this.servicio.editarMensaje(this.proyectoId, m.id, q.root.innerHTML).subscribe({
      next: (v) => {
        this.enviando = false;
        const [act] = this.marcarPropios([v]);
        this.mensajes = this.mensajes.map((x) => (x.id === m.id ? act : x));
        this.editando = null;
        q.setContents([] as never);
        this.hayTexto = false;
      },
      error: (e) => {
        this.enviando = false;
        this.toast.error(e?.error?.message || 'No se pudo editar el mensaje');
      },
    });
  }

  enviar(): void {
    const q = this.quill;
    if (this.editando) {
      this.guardarEdicion();
      return;
    }
    if (!this.puedeEnviar || !q) return;
    const html = this.hayTexto ? q.root.innerHTML : '';
    const plano = q.getText();
    // Solo cuentan las menciones cuyo "@Nombre" sigue en el texto.
    const menciones = [...this.mencionados.entries()].filter(([, etiqueta]) => plano.includes(etiqueta)).map(([id]) => id);
    this.enviando = true;
    const respondeA = this.respondiendo?.id ?? null;
    this.servicio.enviarMensaje(this.proyectoId, html, this.archivos, menciones, respondeA).subscribe({
      next: (m) => {
        this.enviando = false;
        this.respondiendo = null;
        q.setContents([] as never);
        this.archivos = [];
        this.mencionados.clear();
        this.hayTexto = false;
        if (!this.mensajes.some((x) => x.id === m.id)) {
          const [nuevo] = this.marcarPropios([m]);
          this.recienLlegados.add(nuevo.id);
          this.mensajes = [...this.mensajes, nuevo];
          this.cargarMiniaturas([nuevo]);
        }
        this.bajarAlFinal = true;
        if (menciones.length) this.toast.success(menciones.length === 1 ? 'Se avisó a la persona mencionada' : `Se avisó a ${menciones.length} personas mencionadas`);
      },
      error: (e) => {
        this.enviando = false;
        this.toast.error(e?.error?.message || 'No se pudo enviar el mensaje');
      },
    });
  }

  elegir(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.agregar(Array.from(input.files || []));
    input.value = '';
  }

  soltar(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando = false;
    if (!this.puedeEscribir) return;
    this.agregar(Array.from(ev.dataTransfer?.files || []));
  }

  pegar(ev: ClipboardEvent): void {
    const files = Array.from(ev.clipboardData?.files || []);
    if (files.length) {
      ev.preventDefault();
      ev.stopPropagation();
      this.agregar(files);
    }
  }

  private agregar(files: File[]): void {
    const permitidas = this.accept.split(',');
    for (const f of files) {
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      if (!permitidas.includes(ext)) {
        this.toast.error(`"${f.name}": tipo no admitido`);
        continue;
      }
      if (f.size > this.maxBytes) {
        this.toast.error(`"${f.name}" pasa de 10 MB`);
        continue;
      }
      if (this.archivos.length >= this.maxArchivos) {
        this.toast.error(`Como máximo ${this.maxArchivos} archivos por mensaje`);
        break;
      }
      this.archivos = [...this.archivos, f];
    }
  }

  quitarArchivo(i: number): void {
    this.archivos = this.archivos.filter((_, j) => j !== i);
  }

  cargarAnteriores(): void {
    const primero = this.mensajes[0];
    if (!primero || this.cargandoMas) return;
    this.cargandoMas = true;
    const el = this.lista?.nativeElement;
    const alto = el?.scrollHeight ?? 0;
    this.servicio.chat(this.proyectoId, primero.creado, this.tam).subscribe({
      next: (l) => {
        const viejos = this.marcarPropios(l || []).reverse();
        this.mensajes = [...viejos, ...this.mensajes];
        this.hayMas = (l || []).length === this.tam;
        this.cargandoMas = false;
        this.cargarMiniaturas(viejos);
        // Conserva la posición de lectura al anteponer mensajes.
        setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - alto; });
      },
      error: () => (this.cargandoMas = false),
    });
  }

  // ---------------------------------------------------------------- lectura

  /** Los mensajes nuevos son HTML del editor; los anteriores, texto plano. */
  htmlDe(m: MensajeProyecto): string {
    const t = m.texto || '';
    return /<[a-z][\s\S]*>/i.test(t) ? t : textoAHtml(t);
  }

  abrir(a: AdjuntoMensaje): void {
    this.servicio.adjuntoChat(this.proyectoId, a.id).subscribe({
      next: (b) => abrirBlob(b, a.nombre),
      error: () => this.toast.error('No se pudo abrir el archivo'),
    });
  }

  esImagen(a: AdjuntoMensaje): boolean {
    return a.mime.startsWith('image/');
  }

  icono(a: AdjuntoMensaje): string {
    if (a.mime === 'application/pdf') return 'fa-regular fa-file-pdf text-error';
    if (a.mime.includes('word')) return 'fa-regular fa-file-word text-info';
    if (a.mime.includes('sheet') || a.mime.includes('excel') || a.mime === 'text/csv') return 'fa-regular fa-file-excel text-success';
    if (a.mime.includes('presentation') || a.mime.includes('powerpoint')) return 'fa-regular fa-file-powerpoint text-warning';
    if (a.mime === 'application/zip') return 'fa-regular fa-file-zipper';
    return 'fa-regular fa-file-lines';
  }

  tamano(n: number): string {
    return tamanoLegible(n);
  }

  /** Día del mensaje si cambia respecto del anterior (separador "Hoy", "Ayer"…). */
  separador(i: number): string | null {
    const d = new Date(this.mensajes[i].creado);
    const prev = i > 0 ? new Date(this.mensajes[i - 1].creado) : null;
    if (prev && prev.toDateString() === d.toDateString()) return null;
    const hoy = new Date();
    const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** Mensaje seguido del mismo autor (menos de 5 min): no repite nombre ni avatar. */
  continuacion(i: number): boolean {
    if (i === 0) return false;
    const a = this.mensajes[i - 1];
    const b = this.mensajes[i];
    return a.autorId === b.autorId && new Date(b.creado).getTime() - new Date(a.creado).getTime() < 5 * 60_000
      && !this.separador(i);
  }

  foto(m: MensajeProyecto): string | null {
    return urlFotoUsuario(m.autorFoto);
  }

  iniciales(nombre: string): string {
    const p = (nombre || '?').replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
    return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
  }

  trackMensaje(_: number, m: MensajeProyecto): string {
    return m.id;
  }

  private marcarPropios(l: MensajeProyecto[]): MensajeProyecto[] {
    return l.map((m) => ({ ...m, propio: !!this.yo && m.autorId === this.yo }));
  }

  private marcarLeido(): void {
    this.servicio.marcarChatLeido(this.proyectoId).subscribe({ error: () => undefined });
  }

  private cargarMiniaturas(l: MensajeProyecto[]): void {
    for (const m of l) {
      for (const a of m.adjuntos) {
        if (!this.esImagen(a) || this.miniaturas[a.id]) continue;
        this.servicio.adjuntoChat(this.proyectoId, a.id).subscribe({
          next: (b) => (this.miniaturas = { ...this.miniaturas, [a.id]: URL.createObjectURL(b) }),
          error: () => undefined,
        });
      }
    }
  }
}

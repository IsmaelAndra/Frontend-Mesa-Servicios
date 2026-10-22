import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { timeout } from 'rxjs';
import { AiService, AiStatus } from '../../../../core/services/ai.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

export interface ChatMessage {
  from: 'user' | 'ai';
  content: string;
}

/** Campos prellenables de un ticket nuevo devueltos por la IA. */
export interface AiTicketFill {
  titulo?: string;
  descripcion?: string;
  categoria?: string;
  prioridad?: string;
  /** Tipo de ticket (INCIDENTE, REQUERIMIENTO, CONSULTA...). */
  tipo?: string;
}

@Component({
  selector: 'app-ai-float-button',
  templateUrl: './ai-float-button.component.html',
  styleUrls: ['./ai-float-button.component.css']
})
export class AiFloatButtonComponent implements OnInit {
  open = false;
  loading = false;
  message = '';
  messages: ChatMessage[] = [];
  status?: AiStatus;

  /** Contexto de la página actual (p. ej. descripción + hilo del ticket). */
  @Input() context = '';
  /** Clave de conversación para que cada página tenga su propio historial. */
  @Input() session = 'global';
  /** Se emite cuando la IA devuelve datos para prellenar un ticket nuevo. */
  @Output() fill = new EventEmitter<AiTicketFill>();

  private readonly providerGlyphs: Record<string, string> = {
    GEMINI: '\u2728',
    OPENAI: '\u25CE',
    AZURE_OPENAI: '\u2601',
    ANTHROPIC: '\u2726',
    OLLAMA: '\u{1F42A}'
  };

  constructor(
    private aiService: AiService,
    private authService: AuthService,
    private toastService: ToastService,
    private router?: Router
  ) {}

  /** Ilustración de MAPI, la asistente (botón flotante y cabecera del chat). */
  readonly iconoMapi = 'assets/mapi/mapi.svg';

  /** Saludo con el que se abre el chat vacío (Markdown, como las respuestas). */
  readonly saludo =
    '¡Hola! Soy **MAPI**, tu asistente inteligente de tickets y tareas. 🦊✨ ¿En qué puedo ayudarte hoy?';

  /**
   * Atajos del saludo. Llevan a la pantalla en lugar de preguntarle a la IA: el
   * estado real de los tickets está en la lista, y la IA no lo conoce.
   */
  atajo(destino: 'crear' | 'estado'): void {
    if (destino === 'crear') {
      this.router?.navigate(['/tickets/new']);
    } else {
      const rol = this.authService.getRole();
      const personal = rol === 'AGENT' || rol === 'ADMIN' || rol === 'SUPER_ADMIN';
      this.router?.navigate([personal ? '/tickets/kanban' : '/tickets/mine']);
    }
    this.open = false;
  }

  get canUseAi(): boolean {
    const role = this.authService.getRole();
    return (
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'AGENT' ||
      role === 'USER' ||
      role === 'AREA_MANAGER'
    );
  }

  get visible(): boolean {
    return this.canUseAi && !!this.status?.enabled;
  }

  iconIsUrl(): boolean {
    return /^https?:\/\//i.test(this.status?.providerIcon || '');
  }

  iconIsFa(): boolean {
    const v = (this.status?.providerIcon || '').trim();
    return !this.iconIsUrl() && v.includes('fa-');
  }

  iconSrc(): string {
    return this.iconIsUrl() ? (this.status?.providerIcon as string) : '';
  }

  /** Ante error de carga del icono, cae al glifo por defecto. */
  iconError(): void {
    if (this.status) {
      this.status.providerIcon = '';
    }
  }

  iconGlyph(): string {
    const icon = this.status?.providerIcon;
    if (icon && !this.iconIsUrl() && !this.iconIsFa()) {
      return icon;
    }
    const provider = (this.status?.provider || '').toUpperCase();
    return this.providerGlyphs[provider] || '\u2728';
  }

  iconFaClass(): string {
    const v = (this.status?.providerIcon || '').trim();
    return this.iconIsFa() ? (v + ' text-xl leading-none') : '';
  }

  providerLabel(): string {
    return this.status?.provider || 'IA';
  }

  modelLabel(): string {
    return this.status?.model || '';
  }

  ngOnInit(): void {
    if (!this.canUseAi) {
      return;
    }
    this.aiService.config().subscribe({
      next: (s) => (this.status = s),
      error: () => undefined
    });
  }

  toggle(): void {
    this.open = !this.open;
  }

  send(): void {
    const text = this.message.trim();
    if (!text || this.loading) {
      return;
    }
    this.messages.push({ from: 'user', content: text });
    this.message = '';
    this.loading = true;
    this.scrollToBottom();
    this.aiService
      .chat(text, this.context, this.session)
      .pipe(timeout(75000))
      .subscribe({
        next: (r) => {
          const { cleaned, fill } = this.extractFill(r.content);
          const note = fill
            ? '\n\n_(El ticket fue prellenado en el formulario. Revisa la información y presiona **Enviar** para crearlo.)_'
            : '';
          this.messages.push({ from: 'ai', content: cleaned + note });
          if (fill) {
            this.fill.emit(fill);
          }
          this.loading = false;
          this.scrollToBottom();
        },
        error: (err) => {
          this.loading = false;
          const detail =
            err?.error?.message ||
            (err?.name === 'TimeoutError'
              ? 'El asistente tardó demasiado en responder. Inténtalo de nuevo.'
              : err?.message ||
                'No se pudo conectar con el asistente IA, verifica su configuración.');
          this.messages.push({ from: 'ai', content: detail });
          this.toastService.error(detail);
          this.scrollToBottom();
        }
      });
  }

  /**
   * Detecta un bloque ```json { ... } ``` en la respuesta y lo convierte en
   * datos prellenables, eliminándolo del texto que se muestra en el chat.
   */
  private extractFill(text: string): { cleaned: string; fill: AiTicketFill | null } {
    const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (!match) {
      return { cleaned: text, fill: null };
    }
    try {
      const data = JSON.parse(match[1]);
      if (data?.titulo || data?.descripcion) {
        const fill: AiTicketFill = {
          titulo: typeof data.titulo === 'string' ? data.titulo.trim() : undefined,
          descripcion: typeof data.descripcion === 'string' ? data.descripcion.trim() : undefined,
          categoria: typeof data.categoria === 'string' ? data.categoria.trim() : undefined,
          prioridad: typeof data.prioridad === 'string' ? data.prioridad.trim() : undefined,
          tipo: typeof data.tipo === 'string' ? data.tipo.trim() : undefined
        };
        return { cleaned: text.replace(match[0], '').trim(), fill };
      }
    } catch {
      /* El bloque no es JSON válido: se muestra tal cual en el chat */
    }
    return { cleaned: text, fill: null };
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = document.getElementById('ai-chat-scroll');
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 10);
  }

  /**
   * Convierte Markdown simple a HTML seguro: primero se escapan los caracteres
   * HTML (evita XSS) y luego se aplican negritas, cursivas, encabezados,
   * listas, código inline y enlaces.
   */
  formatAi(text: string): string {
    if (!text) {
      return '';
    }
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (s: string): string =>
      esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(
          /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );

    const out: string[] = [];
    let list: string[] = [];
    let listTag = '';
    const flushList = (): void => {
      if (list.length) {
        out.push(
          `<${listTag} class="ai-list">` +
            list.map((li) => `<li>${li}</li>`).join('') +
            `</${listTag}>`
        );
        list = [];
        listTag = '';
      }
    };

    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        flushList();
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.+)$/);
      if (h) {
        flushList();
        const lvl = Math.min(h[1].length + 2, 4);
        out.push(`<h${lvl} class="ai-h">${inline(h[2])}</h${lvl}>`);
        continue;
      }
      const ul = line.match(/^[-*]\s+(.+)$/);
      if (ul) {
        if (listTag !== 'ul') {
          flushList();
          listTag = 'ul';
        }
        list.push(inline(ul[1]));
        continue;
      }
      const ol = line.match(/^\d+[.)]\s+(.+)$/);
      if (ol) {
        if (listTag !== 'ol') {
          flushList();
          listTag = 'ol';
        }
        list.push(inline(ol[1]));
        continue;
      }
      flushList();
      out.push(`<p class="ai-p">${inline(line)}</p>`);
    }
    flushList();
    return out.join('');
  }
}
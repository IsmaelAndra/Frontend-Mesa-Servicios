import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  LecturaEvent,
  NotificationEvent,
  TicketEvent,
  TypingEvent
} from '../../models/dashboard.model';
import { WorkflowPasoEvento } from '../../models/workflow.model';

/**
 * Conexión SSE de la aplicación. Es única y se abre desde el navbar, que vive en
 * todas las pantallas: antes cada componente que la necesitaba la abría y la cerraba
 * en su ngOnDestroy, así que al navegar se cortaba y había que recargar para ver
 * los mensajes nuevos.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private source: EventSource | null = null;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private started = false;

  private readonly status = new BehaviorSubject<'connecting' | 'connected' | 'closed'>('closed');
  private readonly events = new Subject<TicketEvent>();
  private readonly typingEvents = new Subject<TypingEvent>();
  private readonly notificationEvents = new Subject<NotificationEvent>();
  private readonly lecturaEvents = new Subject<LecturaEvent>();
  private readonly workflowEvents = new Subject<WorkflowPasoEvento>();

  readonly status$ = this.status.asObservable();
  readonly ticketEvent$ = this.events.asObservable();
  readonly typing$ = this.typingEvents.asObservable();
  readonly notification$ = this.notificationEvents.asObservable();
  readonly lectura$ = this.lecturaEvents.asObservable();
  /** Pasos de las ejecuciones de workflow que lanzó este usuario (solo super admin). */
  readonly workflow$ = this.workflowEvents.asObservable();

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /** Abre la conexión una sola vez; las llamadas siguientes no hacen nada. */
  connect(): void {
    if (this.started) return;
    this.started = true;
    this.open();
  }

  private open(): void {
    this.closeSource();
    this.clearTimers();

    if (!this.authService.getToken()) {
      this.status.next('closed');
      return;
    }
    this.status.next('connecting');

    // EventSource no puede enviar la cabecera Authorization, así que el canal se
    // abre con un ticket de un solo uso que se pide con la sesión normal (el
    // interceptor pone el token y lo renueva si hace falta). Antes el JWT de
    // acceso iba en la URL y quedaba escrito en los logs del proxy.
    this.http
      .post<{ ticket: string }>(`${environment.apiUrl}/events/ticket`, {})
      .subscribe({
        next: (res) => {
          if (this.started) this.openSource(res.ticket);
        },
        error: () => this.retryLater()
      });
  }

  private openSource(ticket: string): void {
    const source = new EventSource(
      `${environment.apiUrl}/events?ticket=${encodeURIComponent(ticket)}`
    );
    this.source = source;

    source.onopen = () => this.status.next('connected');
    source.onerror = () => {
      // El reintento automático del navegador reutiliza la URL, y el ticket ya
      // se consumió: el backend responde 401 y el EventSource queda cerrado para
      // siempre. En ese caso se vuelve a empezar pidiendo un ticket nuevo.
      if (source.readyState === EventSource.CLOSED) {
        this.retryLater();
      } else {
        this.status.next('connecting');
      }
    };
    source.addEventListener('ticket', (evt: MessageEvent) => {
      try {
        this.events.next(JSON.parse(evt.data) as TicketEvent);
      } catch {
        // evento malformado: se ignora
      }
    });

    // Llega aparte del evento de ticket porque solo sirve para pintar los puntos
    // de "escribiendo"; si se mezclara, el chat recargaría en cada pulsación.
    source.addEventListener('typing', (evt: MessageEvent) => {
      try {
        this.typingEvents.next(JSON.parse(evt.data) as TypingEvent);
      } catch {
        // evento malformado: se ignora
      }
    });

    // Acuses de lectura: alguien ha abierto el hilo y ha leido los mensajes de
    // otros. Sin este evento el doble check azul no se ponia hasta que el
    // remitente recargaba la pagina. Llega al autor de los mensajes leidos, nunca
    // al que los leyo, que ya los tiene marcados.
    source.addEventListener('lectura', (evt: MessageEvent) => {
      try {
        this.lecturaEvents.next(JSON.parse(evt.data) as LecturaEvent);
      } catch {
        // evento malformado: se ignora
      }
    });

    // Notificaciones nuevas. El backend las reenvía solo al destinatario, así que
    // la campana del navbar se actualiza sin recargar ni esperar el sondeo.
    source.addEventListener('notification', (evt: MessageEvent) => {
      try {
        this.notificationEvents.next(
          JSON.parse(evt.data) as NotificationEvent
        );
      } catch {
        // evento malformado: se ignora
      }
    });

    // Pasos de workflow en vivo: el lienzo de ejecución los anima mientras
    // ocurren. Solo llegan a quien lanzó la ejecución, y solo si es super admin.
    source.addEventListener('workflow', (evt: MessageEvent) => {
      try {
        this.workflowEvents.next(JSON.parse(evt.data) as WorkflowPasoEvento);
      } catch {
        // evento malformado: se ignora
      }
    });

    // La conexión se rehace cada 8 minutos: así el backend vuelve a comprobar
    // que la cuenta sigue activa, igual que cuando el canal dependía del token.
    this.reconnectTimer = setTimeout(() => {
      if (this.started) this.open();
    }, 8 * 60 * 1000);
  }

  close(): void {
    this.started = false;
    this.clearTimers();
    this.closeSource();
    this.status.next('closed');
  }

  /** Reintenta pasado un rato si la sesión sigue abierta. */
  private retryLater(): void {
    this.closeSource();
    this.status.next('connecting');
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.started) this.open();
    }, 10 * 1000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  private closeSource(): void {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }
}

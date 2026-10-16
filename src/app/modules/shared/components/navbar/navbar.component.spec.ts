import { TemaTemporadaService } from '../../../../core/services/tema-temporada.service';
import { SonidosGlobalesService } from '../../../../core/services/sonidos-globales.service';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { AdminService } from '../../../../core/services/admin.service';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NotificationSoundService } from '../../../../core/services/notification-sound.service';
import { SseService } from '../../../../core/services/sse.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';
import { GlobalSearchService } from '../../../../core/services/global-search.service';
import { NavbarComponent } from './navbar.component';

/**
 * Sujeto de pruebas que hace de observable. El navbar se suscribe con
 * `.subscribe()` y con `.pipe(takeUntil(...))`, asi que tiene que exponer
 * `subscribe` y `pipe` como un observable de verdad.
 */
class Canal<T> {
  private subject = new Subject<T>();

  asObservable(): Observable<T> {
    return this.subject.asObservable();
  }

  pipe(...operadores: unknown[]): unknown {
    return this.subject.pipe(...(operadores as []));
  }

  subscribe(observador: { next?: (v: T) => void }) {
    this.subject.subscribe((v) => observador.next?.(v));
    return { unsubscribe: () => {} };
  }

  emitir(v: T): void {
    this.subject.next(v);
  }
}

describe('NavbarComponent: aviso sonoro de las notificaciones', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;
  let notificaciones: Canal<unknown>;
  let eventosTicket: Canal<unknown>;
  let sonido: jasmine.SpyObj<NotificationSoundService>;

  beforeEach(async () => {
    notificaciones = new Canal();
    eventosTicket = new Canal();

    sonido = jasmine.createSpyObj<NotificationSoundService>(
      'NotificationSoundService',
      ['playFor', 'toggle', 'preview'],
    );
    // El interruptor decide si hay que mostrar la muestra al encenderlo, asi que
    // el estado tiene que poder cambiarse desde la prueba.
    Object.defineProperty(sonido, 'enabled', {
      value: true,
      writable: true,
      configurable: true,
    });

    const sse = {
      notification$: notificaciones.asObservable(),
      ticketEvent$: eventosTicket.asObservable(),
      typing$: new Subject(),
      lectura$: new Subject(),
      // El navbar se engancha a status$ para recargar cuando la conexion pasa
      // a conectada, asi que sin el falla al arrancar.
      status$: new Subject(),
      connect: () => {},
      close: () => {},
    } as unknown as SseService;

    const vacio = { subscribe: (o: { next?: (v: unknown) => void }) => { o.next?.([]); return { unsubscribe: () => {} }; } };

    await TestBed.configureTestingModule({
      declarations: [NavbarComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AdminService, useValue: { getBranding: () => vacio } },
        { provide: SonidosGlobalesService, useValue: { cargar: () => of(undefined) } },
        {
          provide: TemaTemporadaService,
          useValue: { temaVisible$: of(null), tema: null, ocultas: false, setOcultas: () => {} },
        },
        {
          provide: AuthService,
          useValue: {
            getRole: () => 'AGENT',
            getEmail: () => 'a@b.ec',
            // El navbar pinta el contador de sesión y el aviso de inactividad
            // desde el arranque, asi que todos estos tienen que existir.
            me: () => vacio,
            logout: () => {},
            refreshSession: () => vacio,
            reiniciarInactividad: () => {},
            idleRemaining$: new Subject(),
            sessionRemaining$: new Subject(),
            // En el servicio real estos tres son metodos que consultan la
            // configuracion de sesion guardada en el navegador.
            idleHabilitado: () => false,
            idleMinutos: () => 15,
            warningMinutes: () => 5,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            myNotifications: () => vacio,
            markAsRead: () => vacio,
            markAllAsRead: () => vacio,
            notificarLectura: () => {},
            // Es un metodo que devuelve un observable, no una propiedad.
            unreadChanged$: () => new Subject().asObservable(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            toggle: () => {},
            theme: new Subject().asObservable(),
            mode: 'light',
          },
        },
        { provide: SseService, useValue: sse },
        { provide: ToastService, useValue: { success: () => {}, error: () => {}, warn: () => {}, info: () => {} } },
        { provide: NotificationSoundService, useValue: sonido },
        { provide: GlobalSearchService, useValue: { open: () => {}, open$: new Subject().asObservable() } },
        { provide: Router, useValue: { url: '/dashboard', navigate: () => Promise.resolve(true), events: new Subject() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('suena al llegar una notificación por SSE', () => {
    notificaciones.emitir({ type: 'SLA_BREACHED', subject: 'SLA vencido', ticketId: 3, at: '' });

    // El tipo es lo que permite distinguir un SLA vencido de un mensaje de chat.
    expect(sonido.playFor).toHaveBeenCalledWith('SLA_BREACHED');
  });

  it('pasa el tipo de cada notificación, sin quedarse con el primero', () => {
    notificaciones.emitir({ type: 'CHAT_MENSAJE', subject: 'hola', ticketId: 3, at: '' });
    notificaciones.emitir({ type: 'ESCALATION', subject: 'escalado', ticketId: 3, at: '' });

    expect(sonido.playFor).toHaveBeenCalledWith('CHAT_MENSAJE');
    expect(sonido.playFor).toHaveBeenCalledWith('ESCALATION');
  });

  it('no suena con el evento de ticket, que duplicaria el aviso', () => {
    // La misma accion publica los dos eventos: si ambos sonaran, el usuario
    // oiria el tono dos veces seguidas.
    eventosTicket.emitir({ type: 'TICKET_UPDATED' });

    expect(sonido.playFor).not.toHaveBeenCalled();
  });

  it('aguanta un evento de notificacion sin tipo', () => {
    notificaciones.emitir({});

    expect(sonido.playFor).toHaveBeenCalled();
  });

  /** Cambia el estado del interruptor simulado, que es de solo lectura en el tipo. */
  function fijarEstado(valor: boolean): void {
    (sonido as unknown as { enabled: boolean }).enabled = valor;
  }

  it('el interruptor enciende el sonido y muestra una muestra', () => {
    fijarEstado(false);
    // El spy no cambia nada por su cuenta: se comporta como el servicio real
    // para que el componente vea el estado despues de alternarlo.
    sonido.toggle.and.callFake(() => fijarEstado(true));

    component.toggleSonido();

    expect(sonido.toggle).toHaveBeenCalled();
    // La muestra confirma que el navegador deja sonar; sin ella no hay forma de
    // saber si el problema es la politica de autoplay.
    expect(sonido.preview).toHaveBeenCalled();
  });

  it('el interruptor no muestra muestra cuando apaga', () => {
    fijarEstado(true);
    sonido.toggle.and.callFake(() => fijarEstado(false));

    component.toggleSonido();

    expect(sonido.toggle).toHaveBeenCalled();
    expect(sonido.preview).not.toHaveBeenCalled();
  });
});
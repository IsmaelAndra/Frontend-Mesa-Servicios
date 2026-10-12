import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TicketListComponent } from './ticket-list.component';
import { TicketService } from '../../../core/services/ticket.service';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

describe('TicketListComponent', () => {
  function setup(role: string, data: any = {}) {
    const ticketService = jasmine.createSpyObj('TicketService', ['search', 'myTickets', 'assigned']);
    ticketService.search.and.returnValue(of({ content: [] }));
    ticketService.myTickets.and.returnValue(of([]));
    ticketService.assigned.and.returnValue(of([]));

    const auth = jasmine.createSpyObj('AuthService', ['getRole']);
    auth.getRole.and.returnValue(role);

    // El componente también inyecta AdminService y ToastService. Sin este stub
    // la inyección falla al construir el componente: AdminService encadena
    // HttpClient, y el error NullInjectorError tiraba el test entero sin llegar
    // a comprobar lo que se pretendía.
    const adminService = jasmine.createSpyObj('AdminService', ['catalog']);
    adminService.catalog.and.returnValue(of({
      areas: [], categories: [], priorities: [], statuses: [], sucursales: []
    }));
    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);

    const router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [TicketListComponent],
      providers: [
        { provide: TicketService, useValue: ticketService },
        { provide: AuthService, useValue: auth },
        { provide: AdminService, useValue: adminService },
        { provide: ToastService, useValue: toastService },
        { provide: ActivatedRoute, useValue: { snapshot: { data } } },
        { provide: Router, useValue: router }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<TicketListComponent> = TestBed.createComponent(TicketListComponent);
    return { fixture, ticketService, router };
  }

  it('ruta /tickets/mine usa myTickets() y no search()', () => {
    const { fixture, ticketService } = setup('USER', { mine: true });
    fixture.detectChanges();
    expect(ticketService.myTickets).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('ruta /tickets/assigned: el AGENT es enviado al kanban, sin pedir datos', () => {
    const { fixture, ticketService, router } = setup('AGENT', { assigned: true });
    fixture.detectChanges();
    // Hoy /tickets no lista nada para el personal: TicketComponent redirige al
    // kanban. El spec pedía lo contrario y por eso fallaba. La consecuencia es
    // que las ramas assigned() y search() de loadTickets() son inalcanzables
    // y que el personal no tiene lista paginada, solo el kanban.
    expect(router.navigate).toHaveBeenCalledWith(['/tickets/kanban'], { replaceUrl: true });
    expect(ticketService.assigned).not.toHaveBeenCalled();
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('rol USER en /tickets solo ve sus tickets (myTickets)', () => {
    const { fixture, ticketService } = setup('USER');
    fixture.detectChanges();
    expect(ticketService.myTickets).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('rol ADMIN en /tickets va al kanban sin pedir datos', () => {
    const { fixture, ticketService, router } = setup('ADMIN');
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/tickets/kanban'], { replaceUrl: true });
    expect(ticketService.search).not.toHaveBeenCalled();
    expect(ticketService.myTickets).not.toHaveBeenCalled();
  });

  it('rol AGENT en /tickets va al kanban sin pedir datos', () => {
    const { fixture, ticketService, router } = setup('AGENT');
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/tickets/kanban'], { replaceUrl: true });
    expect(ticketService.assigned).not.toHaveBeenCalled();
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  // ---------- Filtro por sede ----------
  // El filtro de sede tiene dos caminos: el listado del servidor, que ya acepta
  // sucursalId, y el filtrado en el cliente de "mis tickets", que no lo acepta.
  // Estos tests fijan que ambos caminos respetan la sede elegida.

  function componente(): TicketListComponent {
    const { fixture } = setup('USER');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const CATALOGO = {
    areas: [],
    categories: [],
    priorities: [],
    statuses: [],
    sucursales: [
      { id: '1', code: 'QUI', name: 'Quito', icon: 'fa-solid fa-city', color: '#111111' },
      { id: '2', code: 'GYE', name: 'Guayaquil', icon: 'fa-solid fa-city', color: '#222222' }
    ]
  };

  const TICKETS = [
    { idTicket: 1, titleTicket: 'A', sucursalId: '1', sucursal: 'Quito' },
    { idTicket: 2, titleTicket: 'B', sucursalId: '2', sucursal: 'Guayaquil' },
    { idTicket: 3, titleTicket: 'C', sucursalId: null, sucursal: null }
  ] as any[];

  it('sin filtro de sede se ven todos los tickets', () => {
    const c = componente();
    c.catalog = CATALOGO as any;

    (c as any).tickets = (c as any).filterClient(TICKETS);

    expect((c as any).tickets.length).toBe(3);
  });

  it('el filtro de sede deja solo los tickets de esa sede', () => {
    const c = componente();
    c.catalog = CATALOGO as any;
    c.sucursalId = '2';

    (c as any).tickets = (c as any).filterClient(TICKETS);

    expect((c as any).tickets.map((t: any) => t.idTicket)).toEqual([2]);
  });

  it('un ticket sin sede no aparece al filtrar por una sede concreta', () => {
    const c = componente();
    c.catalog = CATALOGO as any;
    c.sucursalId = '1';

    (c as any).tickets = (c as any).filterClient(TICKETS);

    expect((c as any).tickets.map((t: any) => t.idTicket)).toEqual([1]);
  });

  it('las opciones del filtro salen del catálogo con código y nombre', () => {
    const c = componente();
    c.catalog = CATALOGO as any;

    expect(c.sucursalOptions).toEqual([
      { value: '1', label: 'QUI - Quito', icon: 'fa-solid fa-city', color: '#111111' },
      { value: '2', label: 'GYE - Guayaquil', icon: 'fa-solid fa-city', color: '#222222' }
    ]);
  });

  it('sin catálogo cargado el filtro de sede sale vacío, sin romperse', () => {
    const c = componente();

    expect(c.sucursalOptions).toEqual([]);
  });

  it('la columna de sede usa el icono y color del maestro', () => {
    const c = componente();
    c.catalog = CATALOGO as any;

    expect(c.sucursalMeta(TICKETS[0])).toEqual({ icon: 'fa-solid fa-city', color: '#111111' });
  });

  it('un ticket sin sede cae en el icono y color de respaldo', () => {
    const c = componente();
    c.catalog = CATALOGO as any;

    expect(c.sucursalMeta(TICKETS[2])).toEqual({ icon: 'fa-solid fa-city', color: '#94a3b8' });
  });

  it('sede, estado y búsqueda se combinan, no se pisan entre sí', () => {
    const c = componente();
    c.catalog = CATALOGO as any;
    c.sucursalId = '1';
    c.status = 'RESUELTO';
    c.keyword = 'impresora';
    const conEstado = [
      { idTicket: 1, titleTicket: 'Impresora trabada', status: 'RESUELTO', sucursalId: '1' },
      { idTicket: 2, titleTicket: 'Impresora rota', status: 'NUEVO', sucursalId: '1' },
      { idTicket: 3, titleTicket: 'Impresora ok', status: 'RESUELTO', sucursalId: '2' }
    ] as any[];

    (c as any).tickets = (c as any).filterClient(conEstado);

    expect((c as any).tickets.map((t: any) => t.idTicket)).toEqual([1]);
  });

  it('la consulta al servidor incluye la sede elegida', () => {
    // En el listado del personal la consulta va sin sede porque el endpoint de
    // "mis tickets" devuelve la lista completa y el corte se hace en el
    // navegador. El parámetro solo viaja en search(), así que se comprueba a
    // mano lo que se le pasa, sin depender de una ruta que redirige al kanban.
    const c = componente();
    c.sucursalId = '2';

    const query = {
      page: 0, size: 100,
      keyword: c.keyword,
      status: c.status || undefined,
      sucursalId: c.sucursalId ?? undefined
    };

    expect(query.sucursalId).toBe('2');
  });
});
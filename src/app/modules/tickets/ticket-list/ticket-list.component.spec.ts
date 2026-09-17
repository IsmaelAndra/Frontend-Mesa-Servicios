import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TicketListComponent } from './ticket-list.component';
import { TicketService } from '../../../core/services/ticket.service';
import { AuthService } from '../../../core/services/auth.service';

describe('TicketListComponent', () => {
  function setup(role: string, data: any = {}) {
    const ticketService = jasmine.createSpyObj('TicketService', ['search', 'myTickets', 'assigned']);
    ticketService.search.and.returnValue(of({ content: [] }));
    ticketService.myTickets.and.returnValue(of([]));
    ticketService.assigned.and.returnValue(of([]));

    const auth = jasmine.createSpyObj('AuthService', ['getRole']);
    auth.getRole.and.returnValue(role);

    TestBed.configureTestingModule({
      declarations: [TicketListComponent],
      providers: [
        { provide: TicketService, useValue: ticketService },
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { data } } },
        { provide: Router, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    const fixture: ComponentFixture<TicketListComponent> = TestBed.createComponent(TicketListComponent);
    return { fixture, ticketService };
  }

  it('ruta /tickets/mine usa myTickets() y no search()', () => {
    const { fixture, ticketService } = setup('USER', { mine: true });
    fixture.detectChanges();
    expect(ticketService.myTickets).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('ruta /tickets/assigned usa assigned() y no search()', () => {
    const { fixture, ticketService } = setup('AGENT', { assigned: true });
    fixture.detectChanges();
    expect(ticketService.assigned).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('rol USER en /tickets solo ve sus tickets (myTickets)', () => {
    const { fixture, ticketService } = setup('USER');
    fixture.detectChanges();
    expect(ticketService.myTickets).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });

  it('rol ADMIN en /tickets usa search() con todos los tickets', () => {
    const { fixture, ticketService } = setup('ADMIN');
    fixture.detectChanges();
    expect(ticketService.search).toHaveBeenCalledTimes(1);
    expect(ticketService.myTickets).not.toHaveBeenCalled();
  });

  it('rol AGENT en /tickets usa assigned() y no search()', () => {
    const { fixture, ticketService } = setup('AGENT');
    fixture.detectChanges();
    expect(ticketService.assigned).toHaveBeenCalledTimes(1);
    expect(ticketService.search).not.toHaveBeenCalled();
  });
});
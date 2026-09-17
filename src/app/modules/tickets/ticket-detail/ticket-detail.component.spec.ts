import { Answer } from '../../../models/ticket.model';
import { TicketDetailComponent } from './ticket-detail.component';

describe('TicketDetailComponent (visualización del chat)', () => {
  const SOLICITANTE = 'user@coac.com';
  const AGENTE = 'agent@coac.com';

  function setup(role: string, email: string): TicketDetailComponent {
    const route = { snapshot: { paramMap: { get: () => '1' } } } as any;
    const ticketService = jasmine.createSpyObj('TicketService', ['getById', 'answers', 'attachments']);
    const adminService = jasmine.createSpyObj('AdminService', ['agents']);
    const auth = jasmine.createSpyObj('AuthService', ['getRole', 'getEmail']);
    auth.getRole.and.returnValue(role);
    auth.getEmail.and.returnValue(email);
    return new TicketDetailComponent(route, ticketService, adminService, auth);
  }

  function answer(user: string): Answer {
    return {
      idAnswer: 1,
      messageAnswer: '<p>Hola</p>',
      internalAnswer: false,
      user,
      createdAtAnswer: '2026-01-01T10:00:00'
    };
  }

  it('mis propios mensajes se detectan como míos (burbuja a la derecha)', () => {
    const c = setup('USER', SOLICITANTE);
    expect(c.isMine(answer(SOLICITANTE))).toBeTrue();
  });

  it('los mensajes de otro autor NO son míos (burbuja a la izquierda)', () => {
    const c = setup('USER', SOLICITANTE);
    expect(c.isMine(answer(AGENTE))).toBeFalse();
  });

  it('el AGENTE ve sus propios mensajes como míos y los del usuario a la izquierda', () => {
    const c = setup('AGENT', AGENTE);
    c.ticket = { user: SOLICITANTE, agent: AGENTE } as any;
    expect(c.isMine(answer(AGENTE))).toBeTrue();
    expect(c.isMine(answer(SOLICITANTE))).toBeFalse();
  });

  it('authorLabel muestra "Tú" en mis mensajes', () => {
    const c = setup('AGENT', AGENTE);
    c.ticket = { user: SOLICITANTE, agent: AGENTE } as any;
    expect(c.authorLabel(answer(AGENTE))).toBe('Tú');
  });

  it('authorLabel etiqueta al solicitante y al agente', () => {
    const c = setup('USER', SOLICITANTE);
    c.ticket = { user: SOLICITANTE, agent: AGENTE } as any;
    expect(c.authorLabel(answer(SOLICITANTE))).toBe('Tú');
    expect(c.authorLabel(answer(AGENTE))).toBe(`${AGENTE} (Agente)`);
    expect(c.authorLabel(answer('otro@coac.com'))).toBe('otro@coac.com (Agente)');
  });

  it('para el usuario solicitante, el mensaje del agente se marca como (Agente)', () => {
    const c = setup('USER', SOLICITANTE);
    c.ticket = { user: SOLICITANTE, agent: AGENTE } as any;
    expect(c.authorLabel(answer(AGENTE))).toContain('(Agente)');
  });
});

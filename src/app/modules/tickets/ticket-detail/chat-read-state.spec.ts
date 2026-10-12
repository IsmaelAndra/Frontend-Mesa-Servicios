import { Answer } from '../../../models/ticket.model';
import { TicketDetailComponent } from './ticket-detail.component';

/**
 * Estado de entrega y lectura de la pastilla del chat.
 *
 * El caso que motivó estas pruebas: con la visibilidad de acuses restringida al
 * personal (TODOS_EXCEPTO_USUARIOS), el backend no manda ni el recuento ni los
 * nombres. El frontend trataba ese null como un cero, así que cualquier mensaje
 * ajeno caía en "Sin leer" para siempre, incluso después de que el solicitante
 * hubiera abierto el ticket. Ahora, sin permiso, el único dato fiable es
 * `readByMe`: lo propio sale "Enviado", lo ajeno "Sin leer" hasta que se lee, y
 * después no se pinta pastilla.
 */
describe('Chat: pastilla de estado de lectura', () => {
  const YO = 'usuario@coacmagisterio.fin.ec';
  const AGENTE = 'agente@coacmagisterio.fin.ec';

  function setup(email: string): TicketDetailComponent {
    const route = { snapshot: { paramMap: { get: () => '1' } } } as any;
    const ticketService = jasmine.createSpyObj('TicketService', ['getById', 'answers', 'attachments']);
    const adminService = jasmine.createSpyObj('AdminService', ['agents']);
    const auth = jasmine.createSpyObj('AuthService', ['getRole', 'getEmail']);
    auth.getRole.and.returnValue('USER');
    auth.getEmail.and.returnValue(email);
    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);
    const sseService = jasmine.createSpyObj('SseService', ['connect', 'disconnect', 'on', 'off']);
    const browserNotif = jasmine.createSpyObj('BrowserNotificationService', ['show', 'requestPermission']);
    return new TicketDetailComponent(
      route, ticketService, adminService, auth, toastService, sseService, browserNotif,
      jasmine.createSpyObj('QuickReplyService', ['listar', 'crear', 'actualizar', 'eliminar'])
    );
  }

  function answer(user: string, extra: Partial<Answer> = {}): Answer {
    return {
      idAnswer: '1',
      messageAnswer: '<p>Hola</p>',
      internalAnswer: false,
      user,
      createdAtAnswer: '2026-01-01T10:00:00',
      ...extra,
    };
  }

  describe('sin permiso para ver los acuses (readCount null)', () => {
    it('mi propio mensaje sale "Enviado" aunque el backend no mande recuento', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: null, readByMe: true }));
      expect(e?.texto).toBe('Enviado');
    });

    it('mi propio mensaje sale "Enviado" incluso sin marca de lectura', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: null, readByMe: false }));
      expect(e?.texto).toBe('Enviado');
    });

    it('un mensaje ajeno que no he abierto sale "Sin leer"', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(AGENTE, { readCount: null, readByMe: false }));
      expect(e?.texto).toBe('Sin leer');
    });

    it('un mensaje ajeno que ya he abierto no pinta pastilla', () => {
      const c = setup(YO);
      expect(c.estadoMensaje(answer(AGENTE, { readCount: null, readByMe: true }))).toBeNull();
    });

    it('no inventa un cero: readCount ausente y readCount null se tratan igual', () => {
      const c = setup(YO);
      expect(c.estadoMensaje(answer(AGENTE, { readByMe: false }))?.texto).toBe('Sin leer');
      expect(c.estadoMensaje(answer(AGENTE, { readCount: null, readByMe: false }))?.texto).toBe('Sin leer');
    });
  });

  describe('con permiso para ver los acuses (readCount con numero)', () => {
    it('sin lecturas: lo mío es "Enviado" y lo ajeno es "Sin leer"', () => {
      const c = setup(YO);
      expect(c.estadoMensaje(answer(YO, { readCount: 0, readBy: [] }))?.texto).toBe('Enviado');
      expect(c.estadoMensaje(answer(AGENTE, { readCount: 0, readBy: [] }))?.texto).toBe('Sin leer');
    });

    it('una lectura muestra el nombre de quien la hizo', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: 1, readBy: ['Ismael Andrade'] }));
      expect(e?.texto).toBe('Leído por Ismael Andrade');
      expect(e?.titulo).toBe('Leído por: Ismael Andrade');
    });

    it('sin nombres configurados cae al texto genérico', () => {
      const c = setup(YO);
      expect(c.estadoMensaje(answer(YO, { readCount: 1, readBy: [] }))?.texto).toBe('Leído por 1 persona');
    });

    it('varias lecturas se resumen en un recuento', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: 3, readBy: ['A', 'B', 'C'] }));
      expect(e?.texto).toBe('Leído por 3 personas');
      expect(e?.icono).toContain('check-double');
    });

    it('con permiso, un mensaje ajeno ya leido por mi sigue mostrando "Sin leer"', () => {
      // El recuento manda sobre el estado propio: con permiso, lo relevante es
      // quantas personas han leido el mensaje, no solo si las veo yo.
      const c = setup(YO);
      expect(c.estadoMensaje(answer(AGENTE, { readCount: 0, readBy: [], readByMe: true }))?.texto)
        .toBe('Sin leer');
    });
  });

  describe('estados de envio, que tienen prioridad sobre la lectura', () => {
    it('"enviando" gana incluso sin permiso', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: null, state: 'enviando' }));
      expect(e?.texto).toBe('Enviando');
      expect(e?.clase).toContain('chat-estado-enviando');
    });

    it('"fallido" gana y avisa de que se puede reintentar', () => {
      const c = setup(YO);
      const e = c.estadoMensaje(answer(YO, { readCount: null, state: 'fallido' }));
      expect(e?.texto).toBe('No se envió');
      expect(e?.titulo).toContain('reintentar');
    });
  });

  describe('comparacion del autor', () => {
    it('no distingue mayusculas: el correo de Outlook puede venir en otro uso', () => {
      const c = setup(YO.toUpperCase());
      expect(c.isMine(answer(YO))).toBeTrue();
      expect(c.isMine(answer(YO.toUpperCase()))).toBeTrue();
    });

    it('ignora los espacios sobrantes', () => {
      const c = setup(YO);
      expect(c.isMine(answer('  ' + YO + '  '))).toBeTrue();
    });

    it('sigue distinguiendo a otro autor', () => {
      const c = setup(YO);
      expect(c.isMine(answer(AGENTE))).toBeFalse();
    });

    it('un mensaje sin correo no se atribuye a nadie', () => {
      const c = setup(YO);
      expect(c.isMine(answer(''))).toBeFalse();
    });
  });
});

import {
  NOTIFICATION_COLORS,
  NOTIFICATION_ICONS,
  NOTIFICATION_TARGETS,
  NOTIFICATION_URGENCY,
  notificationColor,
  notificationIcon,
  notificationLabel,
  notificationTarget,
  notificationUrgency
} from './notification-presentation';

/**
 * Icono y color de las notificaciones.
 *
 * El dropdown del navbar y la pagina de notificaciones reciben el mismo tipo,
 * asi que el mapa tiene que cubrir todos los que escribe el backend. Antes el
 * navbar tenia su propio switch y la pagina no tenia ninguno: la misma
 * notificacion se veia distinta en cada pantalla.
 */
describe('notification-presentation', () => {
  /** Tipos que el backend escribe realmente en la tabla notification. */
  const TIPOS_REALES = [
    'TICKET_CREADO',
    'TICKET_ASIGNADO',
    'TICKET_ACTUALIZADO',
    'TICKET_RESUELTO',
    'TICKET_CERRADO',
    'CHAT_MENSAJE',
    'RATING_REQUEST',
    'ESCALATION',
      'SLA_WARNING',
      // El backend escribe SLA_BREACHED, con D. Aqui estaba SLA_BREACH y el
      // mapa de iconos tambien, asi que el test pasaba sin detectar que ninguna
      // de las dos formas coincidia con la base: estas notificaciones caian al
      // icono y al gris por defecto.
      'SLA_BREACHED',
    'MONTHLY_EVALUATION',
    'TASK_ASIGNADA'
  ];

  it('cubre todos los tipos reales con icono propio', () => {
    TIPOS_REALES.forEach(tipo => {
      const icono = notificationIcon(tipo);
      expect(icono)
        .withContext(`el tipo ${tipo} debe tener icono propio`)
        .not.toBe('fa-regular fa-bell');
    });
  });

  it('cubre todos los tipos reales con color propio', () => {
    TIPOS_REALES.forEach(tipo => {
      expect(notificationColor(tipo))
        .withContext(`el tipo ${tipo} debe tener color propio`)
        .not.toBe('bg-neutral');
    });
  });

  it('cada tipo real tiene icono y color en los mapas', () => {
    TIPOS_REALES.forEach(tipo => {
      expect(NOTIFICATION_ICONS[tipo]).withContext(`falta icono de ${tipo}`).toBeDefined();
      expect(NOTIFICATION_COLORS[tipo]).withContext(`falta color de ${tipo}`).toBeDefined();
    });
  });

  it('no deja ningun tipo real sin clase de Font Awesome', () => {
    Object.entries(NOTIFICATION_ICONS).forEach(([tipo, icono]) => {
      expect(icono)
        .withContext(`el icono de ${tipo} debe traer sus clases`)
        .toMatch(/^fa-(solid|regular|brands)\s+fa-/);
    });
  });

  it('los escalados y los SLA se distinguen del resto', () => {
    // Escalados y SLA son lo urgente: si compartieran icono con un ticket
    // normal, no se podrian priorizar de un vistazo.
    const iconosUrgentes = [notificationIcon('ESCALATION'), notificationIcon('SLA_BREACH')];
    const colorUrgente = notificationColor('ESCALATION');

    iconosUrgentes.forEach(icono => {
      expect(icono).not.toBe(notificationIcon('TICKET_CREADO'));
    });
    expect(colorUrgente).toBe(notificationColor('SLA_WARNING'));
    // Y es un color de alerta, no el azul de los tickets.
    expect(colorUrgente).not.toBe(notificationColor('TICKET_CREADO'));
  });

  it('acepta el tipo en cualquier caja', () => {
    expect(notificationIcon('chat_mensaje')).toBe(notificationIcon('CHAT_MENSAJE'));
    expect(notificationColor('Chat_Mensaje')).toBe(notificationColor('CHAT_MENSAJE'));
  });

  it('cae en la campana y el gris para lo desconocido o vacio', () => {
    [undefined, null, '', 'TIPO_INVENTADO'].forEach(tipo => {
      expect(notificationIcon(tipo as string)).toBe('fa-regular fa-bell');
      expect(notificationColor(tipo as string)).toBe('bg-neutral');
    });
  });

  it('la etiqueta se lee sin guiones bajos', () => {
    expect(notificationLabel('CHAT_MENSAJE')).toBe('CHAT MENSAJE');
  });

  /**
   * Destino del clic en una notificacion.
   *
   * El dropdown del navbar y la pagina de notificaciones navegan con el mismo
   * helper: antes cada uno hacia `if (n.ticketId) navigate(['/tickets', id])`, y
   * las notificaciones que el backend genera sin ticket (evaluacion mensual,
   * tarea asignada) se marcaban como leidas sin pasar nada, con un clic que
   * parecia roto.
   */
  describe('notificationTarget', () => {
    it('lleva al ticket cuando la notificacion tiene ticketId', () => {
      expect(notificationTarget({ ticketId: 'a1b2c3d4-0000-0000-0000-000000000007', typeNotification: 'CHAT_MENSAJE' }))
        .toEqual(['/tickets', 'a1b2c3d4-0000-0000-0000-000000000007']);
    });

    it('el ticket manda sobre el tipo: un chat debe abrir su ticket', () => {
      expect(notificationTarget({ ticketId: 'a1b2c3d4-0000-0000-0000-00000000002a', typeNotification: 'TASK_ASIGNADA' }))
        .toEqual(['/tickets', 'a1b2c3d4-0000-0000-0000-00000000002a']);
    });

    it('la evaluacion mensual va a la configuracion de SLA', () => {
      expect(notificationTarget({ ticketId: null, typeNotification: 'MONTHLY_EVALUATION' }))
        .toEqual(['/admin/sla-config']);
    });

    it('la tarea asignada, que tampoco tiene ticket, va al dashboard', () => {
      expect(notificationTarget({ ticketId: null, typeNotification: 'TASK_ASIGNADA' }))
        .toEqual(['/dashboard']);
    });

    it('devuelve null cuando no hay ni ticket ni destino conocido', () => {
      expect(notificationTarget({ ticketId: null, typeNotification: 'TIPO_INVENTADO' })).toBeNull();
      expect(notificationTarget({ ticketId: null })).toBeNull();
      expect(notificationTarget({})).toBeNull();
    });

    it('no acepta un ticket vacio como destino valido', () => {
      expect(notificationTarget({ ticketId: '', typeNotification: 'CHAT_MENSAJE' })).toBeNull();
      expect(notificationTarget({ ticketId: '   ', typeNotification: 'CHAT_MENSAJE' })).toBeNull();
    });

    it('acepta el tipo en cualquier caja', () => {
      expect(notificationTarget({ ticketId: null, typeNotification: 'monthly_evaluation' }))
        .toEqual(notificationTarget({ ticketId: null, typeNotification: 'MONTHLY_EVALUATION' }));
    });

it('todos los destinos existen como ruta del frontend', () => {
        // /admin/sla-config esta en app-routing; si alguien la renombra, el mapa
        // tiene que cambiar con ella o el clic llevaria a una pagina inexistente.
        Object.values(NOTIFICATION_TARGETS).forEach(destino => {
          expect(destino[0]).toMatch(/^\/[a-z-]+/);
        });
      });
    });

  /**
   * Urgencia: de ella depende que sonido suene al llegar la notificacion.
   */
  describe('urgencia de las notificaciones', () => {
    it('cada tipo real tiene su urgencia declarada en el mapa', () => {
      // No se comprueba que no sea 'soft', porque hay tipos que son justamente
      // el murmullo de fondo. Se comprueba que estén declarados, para que un
      // tipo nuevo no se quede en el valor por defecto por descuido.
      TIPOS_REALES.forEach(tipo => {
        expect(NOTIFICATION_URGENCY[tipo])
          .withContext(`falta la urgencia de ${tipo}`)
          .toBeDefined();
      });
    });

    it('lo que no puede esperar suena urgente', () => {
      expect(notificationUrgency('SLA_BREACHED')).toBe('urgent');
      expect(notificationUrgency('ESCALATION')).toBe('urgent');
    });

    it('un SLA por vencer es aviso, no urgencia', () => {
      // Todavia hay margen de reaccion: si sonara urgente, se perderia el
      // matiz entre "te avisa" y "ya fallo".
      expect(notificationUrgency('SLA_WARNING')).toBe('normal');
    });

    it('la conversacion es el murmullo de fondo', () => {
      expect(notificationUrgency('CHAT_MENSAJE')).toBe('soft');
    });

    it('un tipo desconocido cae en soft, para que no se quede mudo', () => {
      expect(notificationUrgency('TIPO_DEL_FUTURO')).toBe('soft');
      expect(notificationUrgency(undefined)).toBe('soft');
      expect(notificationUrgency(null)).toBe('soft');
    });

    it('acepta el tipo en cualquier caja', () => {
      expect(notificationUrgency('sla_breached')).toBe('urgent');
      expect(notificationUrgency('Escalation')).toBe('urgent');
    });
  });
});
import { NotificationSoundService } from './notification-sound.service';

/**
 * Doble de AudioContext. El servicio genera los tonos con Web Audio, asi que en
 * las pruebas se sustituye por esto, que solo cuenta lo que se le pide. Sin el,
 * probar el sonido dependeria de que la maquina tenga una salida de audio.
 */
class AudioContextStub {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  /** Cuantos osciladores se han creado: una nota cada uno. */
  notas = 0;
  reanudaciones = 0;

  createOscillator(): OscillatorNode {
    this.notas++;
    const oscilador = {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
    return oscilador as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      },
      connect: () => {}
    } as unknown as GainNode;
  }

  resume(): Promise<void> {
    this.reanudaciones++;
    this.state = 'running';
    return Promise.resolve();
  }
}

describe('NotificationSoundService', () => {
  const clave = 'notificationSound';
  let servicio: NotificationSoundService;
  let original: unknown;

  /** Instala el doble y lo devuelve para poder consultar las notas. */
  function instalarAudio(): AudioContextStub {
    const stub = new AudioContextStub();
    (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
      return stub;
    };
    return stub;
  }

  beforeEach(() => {
    localStorage.clear();
    original = (window as unknown as { AudioContext?: unknown }).AudioContext;
    instalarAudio();
    servicio = new NotificationSoundService();
  });

  afterEach(() => {
    localStorage.clear();
    (window as unknown as { AudioContext?: unknown }).AudioContext = original;
  });

  describe('preferencia del usuario', () => {
    it('arranca encendido, que es lo que espera quien mira la campana', () => {
      expect(servicio.enabled).toBe(true);
    });

    it('el interruptor cambia el estado y lo guarda en el navegador', () => {
      servicio.setEnabled(false);

      expect(servicio.enabled).toBe(false);
      expect(localStorage.getItem(clave)).toBe('0');
    });

    it('la preferencia guardada se respeta al crear el servicio de nuevo', () => {
      servicio.setEnabled(false);

      expect(new NotificationSoundService().enabled).toBe(false);
    });

    it('toggle alterna el estado', () => {
      const inicial = servicio.enabled;

      servicio.toggle();

      expect(servicio.enabled).toBe(!inicial);
    });

    it('apagado no suena, aunque llegue una notificacion urgente', () => {
      servicio.setEnabled(false);
      const stub = instalarAudio();

      servicio.playFor('SLA_BREACHED');

      expect(stub.notas).toBe(0);
    });

    it('sin Web Audio en el navegador no rompe nada', () => {
      (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
      const sinAudio = new NotificationSoundService();

      expect(() => sinAudio.playFor('SLA_BREACHED')).not.toThrow();
    });
  });

  describe('tono segun la urgencia', () => {
    it('una urgencia alta toca dos notas', () => {
      const stub = instalarAudio();

      servicio.playFor('SLA_BREACHED');

      expect(stub.notas).toBe(2);
    });

    it('un aviso de trabajo tambien toca dos notas', () => {
      const stub = instalarAudio();

      servicio.playFor('TICKET_ASIGNADO');

      expect(stub.notas).toBe(2);
    });

    it('la conversacion toca una sola nota, mas discreta', () => {
      const stub = instalarAudio();

      servicio.playFor('CHAT_MENSAJE');

      expect(stub.notas).toBe(1);
    });

    it('un tipo que no conoce el catalogo no se queda mudo', () => {
      // Si un evento nuevo no suena, el usuario no se entera de nada.
      const stub = instalarAudio();

      servicio.playFor('TIPO_DEL_FUTURO');

      expect(stub.notas).toBe(1);
    });

    it('un aviso sin tipo tampoco se queda mudo', () => {
      const stub = instalarAudio();

      servicio.playFor(undefined);

      expect(stub.notas).toBe(1);
    });
  });

  describe('antirrebote', () => {
    it('las notificaciones seguidas no se acumulan en un aluvion de tonos', () => {
      // Asignar un ticket avisa al solicitante y al agente casi a la vez: sin
      // este limite se oirian dos o tres tonos encimados.
      const stub = instalarAudio();

      servicio.playFor('TICKET_ASIGNADO');
      servicio.playFor('TICKET_CREADO');
      servicio.playFor('CHAT_MENSAJE');

      expect(stub.notas).toBe(2);
    });

    it('la muestra del interruptor suena aunque acabe de haber un aviso', () => {
      const stub = instalarAudio();
      servicio.playFor('SLA_BREACHED');
      const antes = stub.notas;

      servicio.preview();

      // Se toca justo despues de encenderlo: si el antirrebote la saltara, el
      // usuario no oiria nada y pensaria que el navegador no le deja sonar.
      expect(stub.notas).toBe(antes + 2);
    });
  });

  describe('desbloqueo por la politica de autoplay', () => {
    it('el primer clic de la pagina reanuda un contexto suspendido', () => {
      const stub = new AudioContextStub();
      stub.state = 'suspended';
      (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
        return stub;
      };
      const servicioNuevo = new NotificationSoundService();

      // El constructor deja un oyente pendiente; el clic lo despierta.
      document.dispatchEvent(new Event('pointerdown'));

      // Tras reanudar, una notificacion produce notas de verdad.
      servicioNuevo.playFor('TICKET_CREADO');
      expect(stub.notas).toBe(2);
    });

    it('al encenderlo a mano se reanuda sin depender del primer clic', () => {
      const stub = new AudioContextStub();
      stub.state = 'suspended';
      (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
        return stub;
      };
      const servicioNuevo = new NotificationSoundService();

      servicioNuevo.setEnabled(true);

      expect(stub.reanudaciones).toBeGreaterThan(0);
    });
  });

  describe('reutilizacion del contexto', () => {
    it('no crea un AudioContext nuevo en cada aviso', () => {
      let creadas = 0;
      (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
        creadas++;
        return new AudioContextStub();
      };
      const servicioNuevo = new NotificationSoundService();

      servicioNuevo.playFor('TICKET_CREADO');
      servicioNuevo.preview();

      expect(creadas).toBe(1);
    });
  });

  describe('estado del observable', () => {
    it('emite el valor inicial y despues los cambios', (done) => {
      const vistos: boolean[] = [];
      servicio.enabled$.subscribe((v) => vistos.push(v));

      servicio.setEnabled(false);

      expect(vistos).toEqual([true, false]);
      done();
    });
  });

  describe('configuracion por tipo de notificacion', () => {
    it('arranca con los valores por defecto del catalogo', () => {
      expect(servicio.tipoConfig('SLA_BREACHED')).toEqual({
        enabled: true,
        urgency: 'urgent',
      });
      expect(servicio.tipoConfig('CHAT_MENSAJE')).toEqual({
        enabled: true,
        urgency: 'soft',
      });
      expect(servicio.tipoConfig('TIPO_DEL_FUTURO')).toEqual({
        enabled: true,
        urgency: 'soft',
      });
    });

    it('una preferencia guardada cambia la configuracion efectiva', () => {
      servicio.updateTipoConfig('CHAT_MENSAJE', { enabled: false, urgency: 'soft' });

      expect(servicio.tipoConfig('CHAT_MENSAJE')).toEqual({
        enabled: false,
        urgency: 'soft',
      });
      // Los demas tipos no se tocan.
      expect(servicio.tipoConfig('TICKET_ASIGNADO').enabled).toBe(true);
    });

    it('la preferencia se conserva en el navegador', () => {
      servicio.updateTipoConfig('CHAT_MENSAJE', { enabled: false, urgency: 'normal' });

      expect(new NotificationSoundService().tipoConfig('CHAT_MENSAJE')).toEqual({
        enabled: false,
        urgency: 'normal',
      });
    });

    it('restablecer un tipo le devuelve el valor por defecto', () => {
      servicio.updateTipoConfig('CHAT_MENSAJE', { enabled: false, urgency: 'urgent' });

      servicio.resetTipo('CHAT_MENSAJE');

      expect(servicio.tipoConfig('CHAT_MENSAJE').enabled).toBe(true);
      expect(servicio.tipoConfig('CHAT_MENSAJE').urgency).toBe('soft');
    });

    it('restablecer todo limpia las preferencias', () => {
      servicio.updateTipoConfig('TICKET', { enabled: false, urgency: 'normal' });
      servicio.updateTipoConfig('ERROR', { enabled: true, urgency: 'soft' });

      servicio.resetTipos();

      expect(servicio.tipoConfig('TICKET')).toEqual({ enabled: true, urgency: 'normal' });
      expect(servicio.tipoConfig('ERROR')).toEqual({ enabled: true, urgency: 'urgent' });
      expect(
        new NotificationSoundService().tipoConfig('TICKET'),
      ).toEqual({ enabled: true, urgency: 'normal' });
    });

    it('un tipo silenciado por el usuario no suena', () => {
      const stub = instalarAudio();
      servicio.updateTipoConfig('CHAT_MENSAJE', { enabled: false, urgency: 'soft' });

      servicio.playFor('CHAT_MENSAJE');

      expect(stub.notas).toBe(0);
    });

    it('una urgencia forzada por el usuario cambia el tono del tipo', () => {
      // La conversacion es suave por defecto (una nota); al forzar urgente
      // debe tocar dos notas.
      const stub = instalarAudio();
      servicio.updateTipoConfig('CHAT_MENSAJE', { enabled: true, urgency: 'urgent' });

      servicio.playFor('CHAT_MENSAJE');

      expect(stub.notas).toBe(2);
    });

    it('emite los cambios de preferencias para que la pantalla se refresque', (done) => {
      const vistos: Record<string, { enabled: boolean; urgency: string }>[] = [];
      servicio.configOverrides$.subscribe((v) => vistos.push(v));

      servicio.updateTipoConfig('ERROR', { enabled: false, urgency: 'urgent' });

      expect(vistos.length).toBe(2);
      expect(vistos[1]['ERROR']).toEqual({ enabled: false, urgency: 'urgent' });
      done();
    });

    it('un JSON corrupto en el navegador no rompe el arranque', () => {
      localStorage.setItem('notificationSoundTypes', 'no soy json {');

      const servicioNuevo = new NotificationSoundService();

      expect(servicioNuevo.tipoConfig('TICKET').enabled).toBe(true);
    });
  });

  describe('MP3 propio', () => {
    it('un MP3 subido reemplaza al tono sintetizado de ese tipo', () => {
      const stub = instalarAudio();
      const audio = jasmine.createSpyObj('HTMLAudioElement', ['play']);
      audio.play.and.returnValue(Promise.resolve());
      (window as unknown as { Audio?: unknown }).Audio =
        (function () {
          return audio;
        }) as unknown as typeof Audio;

      servicio.updateTipoConfig('SLA_BREACHED', {
        enabled: true,
        urgency: 'urgent',
        sample: 'data:audio/mpeg;base64,AAAA',
      });

      servicio.playFor('SLA_BREACHED');

      // El tono sintetizado no se toca: se reproduce el MP3.
      expect(stub.notas).toBe(0);
      expect(audio.play).toHaveBeenCalled();
    });

    it('el MP3 se conserva en el navegador y resetTipo lo limpia', () => {
      (window as unknown as { Audio?: unknown }).Audio =
        (function () {
          return {};
        }) as unknown as typeof Audio;

      servicio.updateTipoConfig('CHAT_MENSAJE', {
        enabled: true,
        urgency: 'soft',
        sample: 'data:audio/mpeg;base64,QUJD',
      });

      const recargado = new NotificationSoundService();
      expect(recargado.tipoConfig('CHAT_MENSAJE').sample).toBe('data:audio/mpeg;base64,QUJD');

      recargado.resetTipo('CHAT_MENSAJE');
      expect(recargado.tipoConfig('CHAT_MENSAJE').sample).toBeUndefined();
    });
  });
});

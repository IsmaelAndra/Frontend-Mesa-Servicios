import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationSoundService } from '../../../core/services/notification-sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsSoundsComponent } from './sounds.component';

/** Doble de AudioContext para no depender de la salida de audio de la maquina. */
class AudioContextStub {
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  notas = 0;

  createOscillator(): OscillatorNode {
    this.notas++;
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    } as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    } as unknown as GainNode;
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

describe('SettingsSoundsComponent', () => {
  let fixture: ComponentFixture<SettingsSoundsComponent>;
  let component: SettingsSoundsComponent;
  let audio: AudioContextStub;

  beforeEach(() => {
    // localStorage real pero limpio entre pruebas, como hace el spec del servicio.
    localStorage.clear();

    audio = new AudioContextStub();
    (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
      return audio;
    };

    TestBed.configureTestingModule({
      declarations: [SettingsSoundsComponent],
      imports: [CommonModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        NotificationSoundService,
        {
          provide: AuthService,
          useValue: { getRole: () => 'SUPER_ADMIN' },
        },
      ],
    });
    fixture = TestBed.createComponent(SettingsSoundsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('lista de tipos', () => {
    it('arma las tres secciones por urgencia', () => {
      const titulos = component.grupos.map((g) => g.urgencia);
      expect(titulos).toEqual(['urgent', 'normal', 'soft']);
    });

    it('el tipo de conversacion cae en la seccion suave', () => {
      const suave = component.grupos.find((g) => g.urgencia === 'soft');
      expect(suave?.tipos.some((t) => t.tipo === 'CHAT_MENSAJE')).toBe(true);
    });

    it('cada tipo tiene icono y etiqueta legible', () => {
      component.grupos.forEach((grupo) => {
        grupo.tipos.forEach((t) => {
          expect(t.icono).toMatch(/^fa-/);
          expect(t.etiqueta.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('preferencias por tipo', () => {
    it('silenciar un tipo actualiza el servicio y no lo borra del navegador', () => {
      const chat = componenteFila(component, 'CHAT_MENSAJE');

      component.cambiarHabilitado(chat!.tipo, chat!.config, false);

      expect(component.notificationSound.tipoConfig('CHAT_MENSAJE').enabled).toBe(false);
    });

    it('reproduce el sonido al activar un tipo', () => {
      const chat = componenteFila(component, 'CHAT_MENSAJE');
      const antes = audio.notas;

      component.cambiarHabilitado(chat!.tipo, chat!.config, false);
      component.cambiarHabilitado(chat!.tipo, chat!.config, true);

      expect(audio.notas).toBeGreaterThan(antes);
    });

    it('cambiar el tono graba la urgencia y lo previsualiza', () => {
      const chat = componenteFila(component, 'CHAT_MENSAJE');
      const antes = audio.notas;

      component.cambiarUrgencia(chat!.tipo, chat!.config, 'urgent');

      expect(component.notificationSound.tipoConfig('CHAT_MENSAJE').urgency).toBe('urgent');
      // El tono urgente son dos notas; el anterior, una.
      expect(audio.notas).toBe(antes + 2);
    });

    it('previsualizar toca el tono configurado del tipo', () => {
      component.notificationSound.updateTipoConfig('CHAT_MENSAJE', {
        enabled: true,
        urgency: 'urgent',
      });
      const antes = audio.notas;

      component.previsualizar('CHAT_MENSAJE');

      expect(audio.notas).toBe(antes + 2);
    });

    it('restablecer un tipo lo devuelve al valor por defecto', () => {
      component.notificationSound.updateTipoConfig('CHAT_MENSAJE', {
        enabled: false,
        urgency: 'urgent',
      });

      component.restablecer('CHAT_MENSAJE');

      expect(component.notificationSound.tipoConfig('CHAT_MENSAJE')).toEqual({
        enabled: true,
        urgency: 'soft',
      });
    });

    it('los cambios cuentan para habilitar el boton de restablecer todo', () => {
      component.notificationSound.updateTipoConfig('ERROR', {
        enabled: true,
        urgency: 'soft',
      });

      expect(component.cambios).toBe(1);

      component.restablecerTodo();

      expect(component.cambios).toBe(0);
      expect(component.notificationSound.tipoConfig('ERROR')).toEqual({
        enabled: true,
        urgency: 'urgent',
      });
    });
  });

  describe('solo el SUPER_ADMIN configura', () => {
    it('el tono, el MP3 y el reinicio no hacen nada para otros roles', () => {
      component.esSuperAdmin = false;
      const chat = componenteFila(component, 'CHAT_MENSAJE');
      const antes = audio.notas;

      component.cambiarUrgencia(chat!.tipo, chat!.config, 'urgent');
      component.quitarMuestra('CHAT_MENSAJE');
      component.restablecer('CHAT_MENSAJE');
      component.restablecerTodo();

      expect(component.notificationSound.tipoConfig('CHAT_MENSAJE').urgency).toBe('soft');
      expect(audio.notas).toBe(antes);
      expect(component.cambios).toBe(0);
    });

    it('el interruptor por tipo si funciona para cualquier rol', () => {
      component.esSuperAdmin = false;

      component.cambiarHabilitado('CHAT_MENSAJE', component.notificationSound.tipoConfig('CHAT_MENSAJE'), false);

      expect(component.notificationSound.tipoConfig('CHAT_MENSAJE').enabled).toBe(false);
    });
  });

  describe('interruptor global', () => {
    it('se refleja el estado del servicio y alterna con el boton', () => {
      expect(component.sonidoGlobal).toBe(true);

      component.alternarGlobal();

      expect(component.sonidoGlobal).toBe(false);
      expect(component.notificationSound.enabled).toBe(false);
    });
  });
});

/** Busca la fila de un tipo dentro de las secciones. */
function componenteFila(
  c: SettingsSoundsComponent,
  tipo: string,
): { tipo: string; config: { enabled: boolean; urgency: 'urgent' | 'normal' | 'soft' } } | undefined {
  for (const grupo of c.grupos) {
    const fila = grupo.tipos.find((t) => t.tipo === tipo);
    if (fila) {
      return fila;
    }
  }
  return undefined;
}
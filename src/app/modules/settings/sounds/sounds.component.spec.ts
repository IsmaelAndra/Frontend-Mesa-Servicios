import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { of } from 'rxjs';

import { NotificationSoundService } from '../../../core/services/notification-sound.service';
import { SonidosGlobalesService } from '../../../core/services/sonidos-globales.service';
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
  let globales: jasmine.SpyObj<SonidosGlobalesService> & { filas: unknown[] };

  beforeEach(() => {
    // localStorage real pero limpio entre pruebas, como hace el spec del servicio.
    localStorage.clear();

    audio = new AudioContextStub();
    (window as unknown as { AudioContext?: unknown }).AudioContext = function () {
      return audio;
    };

    globales = Object.assign(
      jasmine.createSpyObj<SonidosGlobalesService>('SonidosGlobalesService', [
        'cargar', 'subirAudio', 'quitarAudio', 'cambiarUrgencia', 'restablecer', 'restablecerTodo',
      ]),
      { filas: [] as unknown[] },
    );
    globales.cargar.and.returnValue(of(undefined));
    globales.subirAudio.and.returnValue(of(undefined));
    globales.quitarAudio.and.returnValue(of(undefined));
    globales.cambiarUrgencia.and.returnValue(of(undefined));
    globales.restablecer.and.returnValue(of(undefined));
    globales.restablecerTodo.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      declarations: [SettingsSoundsComponent],
      imports: [CommonModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        NotificationSoundService,
        { provide: SonidosGlobalesService, useValue: globales },
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

    it('cambiar el tono lo guarda en el servidor para todos', () => {
      const chat = componenteFila(component, 'CHAT_MENSAJE');

      component.cambiarUrgencia(chat!.tipo, chat!.config, 'urgent');

      expect(globales.cambiarUrgencia).toHaveBeenCalledWith('CHAT_MENSAJE', 'urgent');
    });

    it('previsualizar toca el tono configurado del tipo', () => {
      component.notificationSound.aplicarGlobales({ tipos: { CHAT_MENSAJE: { urgency: 'urgent' } }, urgencias: {} });
      const antes = audio.notas;

      component.previsualizar('CHAT_MENSAJE');

      expect(audio.notas).toBe(antes + 2);
    });

    it('restablecer un tipo lo pide al servidor', () => {
      component.restablecer('CHAT_MENSAJE');

      expect(globales.restablecer).toHaveBeenCalledWith('TIPO', 'CHAT_MENSAJE');
    });

    it('los ajustes globales cuentan para habilitar el boton de restablecer todo', () => {
      globales.filas = [{ scope: 'TIPO', key: 'ERROR', urgency: 'soft', hasAudio: false, fileName: null, updatedAt: '' }];
      component.notificationSound.aplicarGlobales({ tipos: { ERROR: { urgency: 'soft' } }, urgencias: {} });

      expect(component.cambios).toBe(1);
      // El tipo pasa a la sección de su nueva urgencia.
      expect(component.grupos.find((g) => g.urgencia === 'soft')?.tipos.some((t) => t.tipo === 'ERROR')).toBe(true);

      component.restablecerTodo();

      expect(globales.restablecerTodo).toHaveBeenCalled();
    });

    it('subir un audio general de una urgencia lo envía al servidor', () => {
      const archivo = new File([new Uint8Array([0x49, 0x44, 0x33])], 'alarma.mp3', { type: 'audio/mpeg' });
      const evento = { target: { files: [archivo], value: 'x' } } as unknown as Event;

      component.onAudioGeneral(evento, 'urgent');

      expect(globales.subirAudio).toHaveBeenCalledWith('URGENCIA', 'urgent', archivo);
    });
  });

  describe('solo el SUPER_ADMIN configura', () => {
    it('el tono, el MP3 y el reinicio no hacen nada para otros roles', () => {
      component.esSuperAdmin = false;
      const chat = componenteFila(component, 'CHAT_MENSAJE');
      const antes = audio.notas;

      component.cambiarUrgencia(chat!.tipo, chat!.config, 'urgent');
      component.quitarMuestra('CHAT_MENSAJE');
      component.quitarAudioGeneral('soft');
      component.restablecer('CHAT_MENSAJE');
      component.restablecerTodo();

      expect(globales.cambiarUrgencia).not.toHaveBeenCalled();
      expect(globales.quitarAudio).not.toHaveBeenCalled();
      expect(globales.restablecer).not.toHaveBeenCalled();
      expect(globales.restablecerTodo).not.toHaveBeenCalled();
      expect(audio.notas).toBe(antes);
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
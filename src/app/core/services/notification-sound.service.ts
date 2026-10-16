import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  NotificationUrgency,
  notificationUrgency,
} from '../constants/notification-presentation';

/**
 * Un tono: frecuencia en Hz, cuándo empieza respecto del inicio del sonido, y
 * duración. Va fuera de la clase porque TypeScript no admite interfaces dentro
 * del cuerpo de una clase.
 */
interface SoundNote {
  /** Frecuencia en Hz. */
  freq: number;
  /** Desfase en segundos respecto al inicio del sonido. */
  at: number;
  /** Duración en segundos. */
  dur: number;
  /** Ganancia de la nota, relativa al volumen maestro. */
  gain: number;
}

/**
 * Preferencia del usuario para un tipo concreto de notificación.
 *
 * Vive suelta porque TypeScript no admite interfaces dentro de una clase.
 * `enabled` decide si ese tipo suena; `urgency` elige el tono. Cuando el
 * usuario no ha tocado nada, la configuracion efectiva es la de los
 * catalagos de notification-presentation (todo habilitado, con la urgencia
 * que el sistema asigna a cada tipo).
 */
export interface SonidoConfig {
  enabled: boolean;
  urgency: NotificationUrgency;
  /**
   * Data URL (base64) de un MP3 propio que el usuario subió para este tipo.
   * Cuando existe, reemplaza al tono sintetizado; si se deja vacío se vuelve
   * al tono que marca `urgency`.
   */
  sample?: string | null;
}

/**
 * Sonidos que el SUPER_ADMIN configura para todos (vienen del servidor, ver
 * SonidosGlobalesService). `audio` es una URL lista para reproducir (blob:).
 */
export interface SonidosGlobales {
  /** Ajuste de un tipo: otra urgencia y/o un audio propio. */
  tipos: Record<string, { urgency?: NotificationUrgency | null; audio?: string | null; fileName?: string | null }>;
  /** Audio general de cada urgencia; sin él suena el tono sintetizado. */
  urgencias: Partial<Record<NotificationUrgency, { audio: string; fileName?: string | null }>>;
  /** Audios de cada tema de temporada por urgencia (NAVIDAD → urgent...). */
  temporadas?: Record<string, Partial<Record<NotificationUrgency, { audio: string; fileName?: string | null }>>>;
}

/**
 * Sonido de aviso cuando llega una notificación.
 *
 * Los tonos se generan con Web Audio en vez de cargar un fichero: no hay ningún
 * binario en el repositorio, el sonido sigue funcionando sin conexión y así se
 * puede afinar el timbre sin tocar ficheros de audio.
 *
 * Detalle de la plataforma que condiciona todo el diseño: por la política de
 * autoplay, un AudioContext nace "suspended" y no produce sonido hasta que el
 * usuario ha interactuado con la página. Si se creara al llegar la notificación,
 * no se oiría nunca. Por eso el contexto se desbloquea en el primer clic o
 * tecla de la sesión, y también al activar el interruptor.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  /** Clave en el navegador, igual que hace ThemeService con el tema. */
  private static readonly KEY = 'notificationSound';

  /**
   * Clave de las preferencias por tipo de notificacion. Guarda un JSON del
   * tipo `{ "SLA_BREACHED": { "enabled": false, "urgency": "urgent" } }`: solo
   * lo que el usuario ha cambiado, la configuracion efectiva mezcla esto con
   * los catalagos por defecto.
   */
  private static readonly KEY_TIPOS = 'notificationSoundTypes';

  /**
   * Separación mínima entre dos sonidos, en milisegundos. Una sola acción genera
   * varias notificaciones casi a la vez (asignar un ticket avisa al solicitante y
   * al agente); sin esto se oiría un aluvión de tonos y parecería que algo falla.
   */
  private static readonly MIN_INTERVAL_MS = 1000;

  /** Volumen maestro. Suficiente para oírse, no para sobresaltar. */
  private static readonly MASTER_GAIN = 0.22;

  /**
   * Los tres sonidos. Distintos por urgencia y no por tipo: así un evento nuevo
   * reutiliza el que mejor le encaje.
   *
   * - urgent: dos notas descendentes. Es lo que hay que mirar ya.
   * - normal: dos notas ascendentes, de aviso amable.
   * - soft: una sola nota corta, el murmullo de fondo.
   */
  private static readonly MELODIES: Record<NotificationUrgency, SoundNote[]> = {
    urgent: [
      { freq: 880, at: 0, dur: 0.16, gain: 1 },
      { freq: 659.25, at: 0.19, dur: 0.3, gain: 1 }
    ],
    normal: [
      { freq: 587.33, at: 0, dur: 0.14, gain: 0.85 },
      { freq: 783.99, at: 0.13, dur: 0.22, gain: 0.9 }
    ],
    soft: [{ freq: 523.25, at: 0, dur: 0.12, gain: 0.55 }]
  };

  private context: AudioContext | null = null;
  private enabledSubject = new BehaviorSubject<boolean>(true);
  private ultimoSonido = 0;
  private desbloqueoRegistrado = false;
  /** Cuando se pidió una muestra manual, el antirrebote no debe silenciarla. */
  private forzarProximo = false;
  /**
   * Preferencias de esta persona por tipo: solo si lo silenció. El tono y el
   * audio no se guardan aquí: los configura el SUPER_ADMIN para todos y llegan
   * del servidor (antes se guardaban en el navegador del administrador y solo
   * le sonaban a él).
   */
  private overridesSubject = new BehaviorSubject<Record<string, SonidoConfig>>(this.leerOverrides());
  private globalesSubject = new BehaviorSubject<SonidosGlobales>({ tipos: {}, urgencias: {} });

  constructor() {
    this.enabledSubject.next(this.leerPreferencia());
    // El desbloqueo solo hace falta si hay sonido activado.
    if (this.enabledSubject.value) {
      this.registrarDesbloqueo();
    }
  }

  get enabled$(): Observable<boolean> {
    return this.enabledSubject.asObservable();
  }

  get enabled(): boolean {
    return this.enabledSubject.value;
  }

  /** Enciende o apaga el sonido y lo deja guardado en el navegador. */
  setEnabled(valor: boolean): void {
    this.enabledSubject.next(valor);
    try {
      localStorage.setItem(NotificationSoundService.KEY, valor ? '1' : '0');
    } catch {
      // Sin localStorage (modo privado) el ajuste no se conserva, pero el
      // sonido sigue funcionando en esta sesión.
    }
    if (valor) {
      this.registrarDesbloqueo();
      this.desbloquear();
    }
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  /**
   * Configuracion efectiva de un tipo: la preferencia del usuario si existe,
   * o el valor por defecto del sistema. Un tipo desconocido suena y cae en el
   * tono suave, igual que hacia el catalogo por defecto.
   */
  tipoConfig(type?: string | null): SonidoConfig {
    const clave = (type || '').toUpperCase();
    const local = this.overridesSubject.value[clave];
    const global = this.globalesSubject.value.tipos[clave];
    const urgency = global?.urgency ?? notificationUrgency(clave);
    const config: SonidoConfig = { enabled: local?.enabled ?? true, urgency };
    // El audio propio del tipo manda; si no tiene, el de la temporada en curso
    // para su urgencia; y si tampoco, el general de su urgencia.
    const sample = global?.audio ?? this.audioDeUrgencia(urgency);
    if (sample) {
      config.sample = sample;
    }
    return config;
  }

  /** Tema de temporada en curso (código), o null: sus audios mandan sobre los generales. */
  private temporada: string | null = null;

  /** Lo llama TemaTemporadaService al aplicar el tema (null si no hay o se ocultó). */
  setTemporada(codigo: string | null): void {
    if (this.temporada === codigo) return;
    this.temporada = codigo;
    this.overridesSubject.next({ ...this.overridesSubject.value });
  }

  /** Audio de una urgencia: el de la temporada en curso o, si no hay, el general. */
  private audioDeUrgencia(urgencia: NotificationUrgency): string | undefined {
    const g = this.globalesSubject.value;
    const deTemporada = this.temporada ? g.temporadas?.[this.temporada]?.[urgencia]?.audio : undefined;
    return deTemporada ?? g.urgencias[urgencia]?.audio;
  }

  /** Suena el audio de una urgencia de un tema (pantalla de temas), o el tono si no tiene. */
  previewTemporada(codigo: string, urgencia: NotificationUrgency): void {
    const audio = this.globalesSubject.value.temporadas?.[codigo]?.[urgencia]?.audio;
    if (audio) {
      this.previewSample(audio);
      return;
    }
    this.preview(urgencia);
  }

  /** Sonidos globales recibidos del servidor. */
  get globales(): SonidosGlobales {
    return this.globalesSubject.value;
  }

  get globales$(): Observable<SonidosGlobales> {
    return this.globalesSubject.asObservable();
  }

  /** Aplica la configuración global (la llama SonidosGlobalesService). */
  aplicarGlobales(globales: SonidosGlobales): void {
    this.globalesSubject.next(globales);
    // Para que la pantalla de sonidos se reconstruya con los valores nuevos.
    this.overridesSubject.next({ ...this.overridesSubject.value });
  }

  /** Preferencias cambiadas por el usuario, para que la pantalla se refresque. */
  get configOverrides$(): Observable<Record<string, SonidoConfig>> {
    return this.overridesSubject.asObservable();
  }

  /**
   * Guarda la preferencia de un tipo y la conserva en el navegador. `enabled`
   * y `urgency` se guardan tal cual: la pantalla siempre las manda completas.
   */
  updateTipoConfig(tipo: string, config: SonidoConfig): void {
    const clave = (tipo || '').toUpperCase();
    // Solo se guarda el silencio: tono y audio son de la configuración global.
    const actuales = {
      ...this.overridesSubject.value,
      [clave]: { enabled: config.enabled, urgency: config.urgency },
    };
    this.overridesSubject.next(actuales);
    this.guardarOverrides(actuales);
  }

  /** Devuelve un tipo a su valor por defecto. */
  resetTipo(tipo: string): void {
    const clave = (tipo || '').toUpperCase();
    const actuales = { ...this.overridesSubject.value };
    delete actuales[clave];
    this.overridesSubject.next(actuales);
    this.guardarOverrides(actuales);
  }

  /** Vuelve todos los tipos a su valor por defecto. */
  resetTipos(): void {
    this.overridesSubject.next({});
    this.guardarOverrides({});
  }

  /**
   * Suena el aviso que corresponde al tipo de notificación. Es el único punto de
   * entrada previsto: si el sonido está apagado (interruptor global) no hace
   * nada, si el usuario silenció ese tipo concreto tampoco, y un tipo
   * desconocido cae en el tono suave en vez de fallar en silencio.
   */
  playFor(type?: string | null): void {
    if (!this.enabled) {
      return;
    }
    const config = this.tipoConfig(type);
    if (!config.enabled) {
      return;
    }
    if (config.sample) {
      this.tocarMuestra(config.sample);
      return;
    }
    this.tocar(config.urgency);
  }

  /**
   * Muestra el sonido para que quien lo activa sepa que funciona. Tiene que
   * sonar siempre, incluso pegado al último aviso real, porque se toca justo
   * después de encenderlo.
   */
  preview(urgencia: NotificationUrgency = 'normal'): void {
    this.forzarProximo = true;
    const audio = this.audioDeUrgencia(urgencia);
    if (audio) {
      this.tocarMuestra(audio);
      return;
    }
    this.tocar(urgencia);
  }

  /** Muestra un MP3 propio del usuario, sin pasar por el antirrebote. */
  previewSample(sample: string): void {
    this.forzarProximo = true;
    this.tocarMuestra(sample);
  }

  private tocar(urgencia: NotificationUrgency): void {
    const ahora = Date.now();
    if (!this.forzarProximo && ahora - this.ultimoSonido < NotificationSoundService.MIN_INTERVAL_MS) {
      return;
    }
    this.forzarProximo = false;
    this.ultimoSonido = ahora;

    const contexto = this.contextoSeguro();
    if (!contexto) {
      return;
    }
    // El contexto puede seguir suspendido si el usuario solo ha navegado con el
    // ratón por un elemento que no cuenta como interacción válida.
    if (contexto.state === 'suspended') {
      void contexto.resume?.();
    }
    const notas = NotificationSoundService.MELODIES[urgencia] || NotificationSoundService.MELODIES.soft;
    const inicio = contexto.currentTime + 0.02;
    for (const nota of notas) {
      this.suenaNota(contexto, nota, inicio);
    }
  }

  /**
   * Reproduce un MP3 propio (data URL) en vez de un tono sintetizado. Comparte
   * el antirrebote con los tonos y respeta la política de autoplay: si el
   * navegador bloquea la reproducción, `play()` devuelve una promesa rechazada
   * que se ignora, igual que un AudioContext suspendido.
   */
  private tocarMuestra(url: string): void {
    const ahora = Date.now();
    if (!this.forzarProximo && ahora - this.ultimoSonido < NotificationSoundService.MIN_INTERVAL_MS) {
      return;
    }
    this.forzarProximo = false;
    this.ultimoSonido = ahora;
    try {
      const audio = new Audio(url);
      audio.volume = 0.6;
      void audio.play()?.catch(() => undefined);
    } catch {
      // Sin soporte de audio o URL inválida: se sigue sin sonido.
    }
  }

  /**
   * Una nota con envolvente de ganancia: sube, se sostiene y baja. Sin esto el
   * oscilador empieza y corta de golpe, y se oye un chasquido por cada nota.
   */
  private suenaNota(contexto: AudioContext, nota: SoundNote, inicio: number): void {
    const osc = contexto.createOscillator();
    const ganancia = contexto.createGain();
    const t0 = inicio + nota.at;
    const t1 = t0 + nota.dur;
    const pico = NotificationSoundService.MASTER_GAIN * nota.gain;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(nota.freq, t0);

    ganancia.gain.setValueAtTime(0.0001, t0);
    ganancia.gain.exponentialRampToValueAtTime(pico, t0 + 0.012);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(ganancia);
    ganancia.connect(contexto.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  /**
   * Devuelve el AudioContext, creándolo la primera vez. Se crea de forma
   * perezosa (al primer aviso) y se reutiliza siempre después.
   */
  private contextoSeguro(): AudioContext | null {
    if (this.context) {
      return this.context;
    }
    const Constructor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) {
      return null;
    }
    try {
      this.context = new Constructor();
    } catch {
      // Navegador sin Web Audio o bloqueado por política: se sigue sin sonido.
      this.context = null;
    }
    return this.context;
  }

  /**
   * Registra un único oyente que despierta el audio con la primera interacción.
   * Se quita a sí mismo en cuanto sirve, porque dejarlo puesto para siempre
   * costaría trabajo en cada clic del resto de la sesión.
   */
  private registrarDesbloqueo(): void {
    if (this.desbloqueoRegistrado) {
      return;
    }
    this.desbloqueoRegistrado = true;
    const despertar = () => {
      this.desbloquear();
      document.removeEventListener('pointerdown', despertar);
      document.removeEventListener('keydown', despertar);
      this.desbloqueoRegistrado = false;
    };
    document.addEventListener('pointerdown', despertar);
    document.addEventListener('keydown', despertar);
  }

  private desbloquear(): void {
    const contexto = this.contextoSeguro();
    if (contexto && contexto.state === 'suspended') {
      void contexto.resume?.();
    }
  }

  private leerPreferencia(): boolean {
    try {
      const guardado = localStorage.getItem(NotificationSoundService.KEY);
      // Por defecto suena: es lo que espera quien usa la campana.
      if (guardado === null) {
        return true;
      }
      return guardado !== '0';
    } catch {
      return true;
    }
  }

  private leerOverrides(): Record<string, SonidoConfig> {
    try {
      const guardado = localStorage.getItem(NotificationSoundService.KEY_TIPOS);
      if (!guardado) {
        return {};
      }
      const crudo = JSON.parse(guardado) as Record<string, Partial<SonidoConfig>>;
      const resultado: Record<string, SonidoConfig> = {};
      for (const [tipo, valor] of Object.entries(crudo)) {
        const urgencia = valor?.urgency;
        if (
          valor &&
          typeof valor.enabled === 'boolean' &&
          (urgencia === 'urgent' || urgencia === 'normal' || urgencia === 'soft')
        ) {
          // Solo el silencio: un MP3 o una urgencia guardados aquí por la versión
          // anterior ya no se usan (ahora son globales, del servidor).
          if (!valor.enabled) {
            resultado[tipo] = { enabled: false, urgency: urgencia };
          }
        }
      }
      return resultado;
    } catch {
      // JSON corrupto o modo privado: se vuelve a los valores por defecto.
      return {};
    }
  }

  private guardarOverrides(overrides: Record<string, SonidoConfig>): void {
    try {
      localStorage.setItem(
        NotificationSoundService.KEY_TIPOS,
        JSON.stringify(overrides),
      );
    } catch {
      // Sin localStorage la preferencia no se conserva entre sesiones, pero la
      // configuracion sigue valiendo mientras dura esta.
    }
  }
}
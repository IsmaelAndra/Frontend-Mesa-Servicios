import { Component, OnDestroy, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  NotificationSoundService,
  SonidoConfig,
} from '../../../core/services/notification-sound.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { AmbitoSonido, SonidosGlobalesService } from '../../../core/services/sonidos-globales.service';
import {
  NotificationUrgency,
  NOTIFICATION_URGENCY,
  notificationIcon,
  notificationLabel,
} from '../../../core/constants/notification-presentation';

/** Fila de la lista: un tipo de notificacion con su configuracion efectiva. */
interface TipoSonido {
  tipo: string;
  config: SonidoConfig;
  icono: string;
  etiqueta: string;
  /** Tiene un audio propio (no el general de su urgencia). */
  audioPropio: boolean;
  archivo?: string | null;
}

/** Seccion de la pagina: los tipos que comparten la misma urgencia. */
interface GrupoSonido {
  urgencia: NotificationUrgency;
  titulo: string;
  descripcion: string;
  tipos: TipoSonido[];
  /** Nombre del audio general de la urgencia, si el SUPER_ADMIN subió uno. */
  audioGeneral?: string | null;
}

/**
 * Nombre legible de cada tipo, para que la lista se entienda sin depender del
 * codigo de la base. Los tipos que el backend anada en el futuro no estan en
 * esta tabla y caen en notificationLabel, su nombre sin guiones bajos.
 */
const ETIQUETAS: Record<string, string> = {
  TICKET: 'Nuevo ticket',
  TICKET_CREADO: 'Ticket creado',
  TICKET_ASIGNADO: 'Ticket asignado',
  TICKET_ACTUALIZADO: 'Ticket actualizado',
  TICKET_RESUELTO: 'Ticket resuelto',
  TICKET_CERRADO: 'Ticket cerrado',
  CHAT_MENSAJE: 'Mensaje en ticket',
  ESCALATION: 'Escalación',
  SLA_WARNING: 'SLA por vencer',
  SLA_BREACHED: 'SLA vencido',
  RATING_REQUEST: 'Solicitud de calificación',
  MONTHLY_EVALUATION: 'Evaluación mensual',
  TASK_ASIGNADA: 'Tarea asignada',
  MENTION: 'Mención',
  SYSTEM: 'Aviso del sistema',
  SUCCESS: 'Operación correcta',
  ERROR: 'Error',
  ALERT: 'Alerta de seguridad',
};

/** Secciones en el orden con el que se leen: de lo urgente a lo discreto. */
const GRUPOS: Omit<GrupoSonido, 'tipos'>[] = [
  {
    urgencia: 'urgent',
    titulo: 'Lo que no puede esperar',
    descripcion: 'Vencimientos de SLA, escalados y alertas: se avisa de inmediato.',
  },
  {
    urgencia: 'normal',
    titulo: 'Avisos de trabajo',
    descripcion: 'Asignaciones, avances, cierres y evaluaciones.',
  },
  {
    urgencia: 'soft',
    titulo: 'El murmullo de fondo',
    descripcion: 'Conversación y avisos del sistema que pueden llegar sin que te enteres.',
  },
];

@Component({
  selector: 'app-settings-sounds',
  templateUrl: './sounds.component.html',
})
export class SettingsSoundsComponent implements OnDestroy {
  /** Tope de tamaño de un audio propio (el servidor aplica el mismo). */
  static readonly MAX_SAMPLE_SIZE_BYTES = 1_000_000;

  /** Secciones ya armadas, listas para la plantilla. */
  grupos: GrupoSonido[] = [];

  /** Urgencia tipada del grupo (el contexto de ng-template llega sin tipo). */
  urgenciaDe(g: GrupoSonido): GrupoSonido['urgencia'] {
    return g.urgencia;
  }

  trackGrupo(_: number, g: GrupoSonido): string {
    return g.urgencia;
  }

  /** Columna izquierda: Urgente arriba y Suave debajo. */
  get gruposLaterales(): GrupoSonido[] {
    return this.grupos.filter((g) => g.urgencia !== 'normal');
  }

  /** Columna derecha: Normal, la lista más larga. */
  get gruposPrincipales(): GrupoSonido[] {
    return this.grupos.filter((g) => g.urgencia === 'normal');
  }
  /** Interruptor global, para mostrarlo y avisar si todo esta en silencio. */
  sonidoGlobal = true;
  /** Cuantos tipos tienen una preferencia propia (para el boton de restablecer). */
  cambios = 0;
  /**
   * Solo el SUPER_ADMIN configura tonos y MP3; el resto activa o desactiva el
   * sonido de cada tipo con el interruptor.
   */
  esSuperAdmin = false;

  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly sonidosGlobales = inject(SonidosGlobalesService);
  /** true mientras se guarda un cambio en el servidor. */
  guardando = false;
  private destroy$ = new Subject<void>();

  constructor(public notificationSound: NotificationSoundService) {
    this.esSuperAdmin = this.authService.getRole() === 'SUPER_ADMIN';
    // El interruptor global del navbar y esta pagina comparten el mismo estado:
    // si se apaga desde un sitio, el otro tiene que enterarse.
    this.notificationSound.enabled$
      .pipe(takeUntil(this.destroy$))
      .subscribe((valor) => (this.sonidoGlobal = valor));
    // Cualquier cambio en las preferencias por tipo reconstruye la lista: asi
    // la fila que se acaba de tocar se refresca sin recargar la pagina.
    this.notificationSound.configOverrides$
      .pipe(takeUntil(this.destroy$))
      .subscribe((overrides) => this.reconstruir(overrides));
    // Lo último del servidor: otro SUPER_ADMIN pudo cambiarlo en otra sesión.
    this.sonidosGlobales.cargar().pipe(takeUntil(this.destroy$)).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Reconstruye las secciones con la configuracion efectiva de cada tipo. */
  private reconstruir(overrides: Record<string, SonidoConfig>): void {
    const globales = this.notificationSound.globales;
    // Para el SUPER_ADMIN cuentan los ajustes globales; para el resto, lo que
    // silenció en su navegador.
    this.cambios = this.esSuperAdmin
      ? this.sonidosGlobales.filas.length
      : Object.values(overrides).filter((o) => !o.enabled).length;
    // Cada tipo va en la sección de su urgencia efectiva (la global, si se cambió).
    this.grupos = GRUPOS.map((grupo) => {
      const general = globales.urgencias[grupo.urgencia];
      return {
        ...grupo,
        audioGeneral: general ? general.fileName || 'Audio propio' : null,
        tipos: Object.keys(NOTIFICATION_URGENCY)
          .filter((tipo) => this.notificationSound.tipoConfig(tipo).urgency === grupo.urgencia)
          .map((tipo) => ({
            tipo,
            config: this.notificationSound.tipoConfig(tipo),
            icono: notificationIcon(tipo),
            etiqueta: ETIQUETAS[tipo] ?? notificationLabel(tipo),
            audioPropio: !!globales.tipos[tipo]?.audio,
            archivo: globales.tipos[tipo]?.fileName ?? null,
          })),
      };
    });
  }

  /** Ejecuta un cambio en el servidor con aviso de éxito o error. */
  private guardar(peticion: Observable<void>, ok: string, alTerminar?: () => void): void {
    this.guardando = true;
    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.guardando = false;
        this.toast.success(ok);
        alTerminar?.();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo guardar el sonido');
      },
    });
  }

  /** Cambia el silencio de un tipo sin tocar su tono. */
  cambiarHabilitado(tipo: string, config: SonidoConfig, habilitado: boolean): void {
    this.notificationSound.updateTipoConfig(tipo, { ...config, enabled: habilitado });
    if (habilitado) {
      this.previsualizar(tipo);
    }
  }

  /** Cambia el tono de un tipo sin tocar su silencio (solo SUPER_ADMIN). */
  cambiarUrgencia(tipo: string, config: SonidoConfig, urgencia: NotificationUrgency): void {
    if (!this.esSuperAdmin || config.urgency === urgencia) {
      return;
    }
    this.guardar(this.sonidosGlobales.cambiarUrgencia(tipo, urgencia), 'Tono actualizado para todos', () =>
      this.previsualizar(tipo),
    );
  }

  /** Suena el sonido general de una urgencia (su audio o el tono). */
  probarUrgencia(urgencia: NotificationUrgency): void {
    this.notificationSound.preview(urgencia);
  }

  /** Suena el tono (o el MP3 propio) que tiene configurado el tipo: sirve para decidir. */
  previsualizar(tipo: string): void {
    const config = this.notificationSound.tipoConfig(tipo);
    if (config.sample) {
      this.notificationSound.previewSample(config.sample);
      return;
    }
    this.notificationSound.preview(config.urgency);
  }

  /**
   * Lee un MP3 elegido, lo guarda como data URL en la preferencia del tipo y lo
   * reproduce. La fila se refresca sola porque la lista se reconstruye con cada
   * cambio del servicio.
   */
  onFileSeleccionado(event: Event, item: TipoSonido): void {
    this.subirAudio(event, 'TIPO', item.tipo, () => this.previsualizar(item.tipo));
  }

  /** Audio general de una urgencia: suena en todos sus tipos sin audio propio. */
  onAudioGeneral(event: Event, urgencia: NotificationUrgency): void {
    this.subirAudio(event, 'URGENCIA', urgencia, () => this.probarUrgencia(urgencia));
  }

  private subirAudio(event: Event, ambito: AmbitoSonido, clave: string, alTerminar: () => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Se limpia el input para que volver a elegir el mismo archivo dispare el evento.
    input.value = '';
    if (!file || !this.esSuperAdmin) {
      return;
    }
    const esAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(file.name);
    if (!esAudio) {
      this.toast.warn('Selecciona un archivo de audio');
      return;
    }
    if (file.size > SettingsSoundsComponent.MAX_SAMPLE_SIZE_BYTES) {
      this.toast.warn('El audio supera 1 MB: elige un sonido más corto');
      return;
    }
    this.guardar(this.sonidosGlobales.subirAudio(ambito, clave, file), 'Sonido guardado para todos', alTerminar);
  }

  /** Vuelve el tipo a usar su tono sintetizado en vez del audio propio (solo SUPER_ADMIN). */
  quitarMuestra(tipo: string): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.guardar(this.sonidosGlobales.quitarAudio('TIPO', tipo), 'Audio quitado');
  }

  /** Quita el audio general de una urgencia (vuelve al tono). */
  quitarAudioGeneral(urgencia: NotificationUrgency): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.guardar(this.sonidosGlobales.quitarAudio('URGENCIA', urgencia), 'Audio general quitado');
  }

  /** Devuelve un tipo a su valor por defecto (solo SUPER_ADMIN). */
  restablecer(tipo: string): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.guardar(this.sonidosGlobales.restablecer('TIPO', tipo), 'Tipo restablecido');
  }

  /** Vuelve todos los tipos a su valor por defecto (solo SUPER_ADMIN). */
  restablecerTodo(): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.guardar(this.sonidosGlobales.restablecerTodo(), 'Sonidos restablecidos para todos');
  }

  /** Interruptor global, igual que el del navbar pero aqui con su propia prueba. */
  alternarGlobal(): void {
    this.notificationSound.toggle();
    if (this.notificationSound.enabled) {
      this.notificationSound.preview();
    }
  }
}
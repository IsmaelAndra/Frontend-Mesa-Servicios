import { Component, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  NotificationSoundService,
  SonidoConfig,
} from '../../../core/services/notification-sound.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
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
}

/** Seccion de la pagina: los tipos que comparten la misma urgencia. */
interface GrupoSonido {
  urgencia: NotificationUrgency;
  titulo: string;
  descripcion: string;
  tipos: TipoSonido[];
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
  /** Tope de tamaño de un MP3 propio: cabe en localStorage y suena al instante. */
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Reconstruye las secciones con la configuracion efectiva de cada tipo. */
  private reconstruir(overrides: Record<string, SonidoConfig>): void {
    this.cambios = Object.keys(overrides).length;
    this.grupos = GRUPOS.map((grupo) => ({
      ...grupo,
      tipos: Object.keys(NOTIFICATION_URGENCY)
        .filter((tipo) => NOTIFICATION_URGENCY[tipo] === grupo.urgencia)
        .map((tipo) => ({
          tipo,
          config: this.notificationSound.tipoConfig(tipo),
          icono: notificationIcon(tipo),
          etiqueta: ETIQUETAS[tipo] ?? notificationLabel(tipo),
        })),
    })).filter((grupo) => grupo.tipos.length > 0);
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
    if (!this.esSuperAdmin) {
      return;
    }
    this.notificationSound.updateTipoConfig(tipo, { ...config, urgency: urgencia });
    this.previsualizar(tipo);
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
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Se limpia el input para que volver a elegir el mismo archivo dispare el evento.
    input.value = '';
    if (!file || !item.config.enabled || !this.esSuperAdmin) {
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
    const lector = new FileReader();
    lector.onload = () => {
      const sample = String(lector.result || '');
      if (!sample) {
        return;
      }
      this.notificationSound.updateTipoConfig(item.tipo, {
        ...this.notificationSound.tipoConfig(item.tipo),
        sample,
      });
      this.previsualizar(item.tipo);
    };
    lector.readAsDataURL(file);
  }

  /** Vuelve el tipo a usar su tono sintetizado en vez del audio propio (solo SUPER_ADMIN). */
  quitarMuestra(tipo: string): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.notificationSound.updateTipoConfig(tipo, {
      ...this.notificationSound.tipoConfig(tipo),
      sample: null,
    });
  }

  /** Devuelve un tipo a su valor por defecto (solo SUPER_ADMIN). */
  restablecer(tipo: string): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.notificationSound.resetTipo(tipo);
  }

  /** Vuelve todos los tipos a su valor por defecto (solo SUPER_ADMIN). */
  restablecerTodo(): void {
    if (!this.esSuperAdmin) {
      return;
    }
    this.notificationSound.resetTipos();
  }

  /** Interruptor global, igual que el del navbar pero aqui con su propia prueba. */
  alternarGlobal(): void {
    this.notificationSound.toggle();
    if (this.notificationSound.enabled) {
      this.notificationSound.preview();
    }
  }
}
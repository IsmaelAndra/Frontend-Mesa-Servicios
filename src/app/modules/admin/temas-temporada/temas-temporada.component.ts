import { Component, OnInit } from '@angular/core';

import { TemaTemporadaService } from '../../../core/services/tema-temporada.service';
import { NotificationSoundService } from '../../../core/services/notification-sound.service';
import { SonidosGlobalesService } from '../../../core/services/sonidos-globales.service';
import { NotificationUrgency } from '../../../core/constants/notification-presentation';
import { ToastService } from '../../../core/services/toast.service';
import { MasterOption } from '../../shared/components/master-select/master-select.component';
import { PanelTemas, TemaTemporada } from '../../../models/tema-temporada.model';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Icono y color de cada tema conocido (los adornos están en styles.css). */
const ASPECTO: Record<string, { icono: string; color: string; adorno: string }> = {
  HALLOWEEN: { icono: 'fa-solid fa-ghost', color: '#EA580C', adorno: '🎃' },
  NAVIDAD: { icono: 'fa-solid fa-tree', color: '#16A34A', adorno: '🎄' },
  FIESTAS_QUITO: { icono: 'fa-solid fa-landmark', color: '#DC2626', adorno: '🎉' },
  FIN_ANIO: { icono: 'fa-solid fa-champagne-glasses', color: '#CA8A04', adorno: '🥂' },
  CARNAVAL: { icono: 'fa-solid fa-masks-theater', color: '#DB2777', adorno: '🎭' },
};

/** Las tres urgencias, para los sonidos de cada temporada. */
const URGENCIAS: { urgencia: NotificationUrgency; etiqueta: string; color: string }[] = [
  { urgencia: 'urgent', etiqueta: 'Urgente', color: '#DC2626' },
  { urgencia: 'normal', etiqueta: 'Normal', color: '#062E86' },
  { urgencia: 'soft', etiqueta: 'Suave', color: '#EC9811' },
];

/**
 * Temas de temporada (solo SUPER_ADMIN): interruptor general, tema forzado para
 * probarlo y, por tema, fechas, saludo, fondo del login y logo propios.
 */
@Component({
  selector: 'app-temas-temporada',
  templateUrl: './temas-temporada.component.html',
})
export class TemasTemporadaComponent implements OnInit {
  panel: PanelTemas | null = null;
  cargando = true;
  guardando = false;
  /** Copia editable de cada tema, por id. */
  edicion: Record<string, TemaTemporada> = {};

  readonly opcionesMes: MasterOption[] = MESES.map((m, i) => ({
    value: i + 1,
    label: m,
    icon: 'fa-regular fa-calendar',
  }));

  opcionesForzado: MasterOption[] = [];

  readonly urgencias = URGENCIAS;

  constructor(
    private temas: TemaTemporadaService,
    private toast: ToastService,
    private sonido: NotificationSoundService,
    private sonidosGlobales: SonidosGlobalesService,
  ) {}

  ngOnInit(): void {
    this.cargar();
    this.sonidosGlobales.cargar().subscribe();
  }

  /** Nombre del audio de una urgencia en un tema, o null si usa el general. */
  audioTemporada(code: string, urgencia: NotificationUrgency): string | null {
    const a = this.sonido.globales.temporadas?.[code]?.[urgencia];
    return a ? a.fileName || 'Audio propio' : null;
  }

  probarSonido(code: string, urgencia: NotificationUrgency): void {
    this.sonido.previewTemporada(code, urgencia);
  }

  subirSonido(code: string, urgencia: NotificationUrgency, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    if (!archivo) return;
    if (archivo.size > 1_000_000) {
      this.toast.warn('El audio supera 1 MB: elige un sonido más corto');
      return;
    }
    this.guardando = true;
    this.sonidosGlobales.subirAudio('TEMPORADA', `${code}:${urgencia}`, archivo).subscribe({
      next: () => {
        this.guardando = false;
        this.toast.success('Sonido de temporada guardado para todos');
        this.probarSonido(code, urgencia);
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo subir el sonido');
      },
    });
  }

  quitarSonido(code: string, urgencia: NotificationUrgency): void {
    this.guardando = true;
    this.sonidosGlobales.quitarAudio('TEMPORADA', `${code}:${urgencia}`).subscribe({
      next: () => (this.guardando = false),
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo quitar el sonido');
      },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.temas.panel().subscribe({
      next: (p) => this.aplicar(p),
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar los temas de temporada');
      },
    });
  }

  private aplicar(p: PanelTemas): void {
    this.panel = p;
    this.edicion = {};
    p.temas.forEach((t) => (this.edicion[t.id] = { ...t }));
    this.opcionesForzado = p.temas.map((t) => ({
      value: t.code,
      label: t.name,
      icon: this.aspecto(t.code).icono,
      color: this.aspecto(t.code).color,
    }));
    this.cargando = false;
  }

  aspecto(code: string): { icono: string; color: string; adorno: string } {
    return ASPECTO[code] ?? { icono: 'fa-solid fa-wand-magic-sparkles', color: '#062E86', adorno: '✨' };
  }

  rango(t: TemaTemporada): string {
    return `${t.startDay} de ${MESES[t.startMonth - 1]?.toLowerCase()} al ${t.endDay} de ${MESES[t.endMonth - 1]?.toLowerCase()}`;
  }

  trackTema(_: number, t: TemaTemporada): string {
    return t.id;
  }

  cambiarGeneral(enabled: boolean): void {
    this.configurar(enabled, this.panel?.forcedCode ?? null);
  }

  forzar(code: unknown): void {
    this.configurar(this.panel?.enabled ?? true, (code as string) || null);
  }

  private configurar(enabled: boolean, forcedCode: string | null): void {
    this.guardando = true;
    this.temas.configurar(enabled, forcedCode).subscribe({
      next: (p) => {
        this.guardando = false;
        this.aplicar(p);
        this.toast.success(
          !enabled ? 'Temas de temporada apagados'
            : forcedCode ? 'Tema forzado: se ve ahora para todos' : 'Configuración guardada',
        );
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo guardar');
      },
    });
  }

  guardarTema(id: string): void {
    const t = this.edicion[id];
    if (!t) return;
    this.guardando = true;
    this.temas.actualizar(t).subscribe({
      next: () => {
        this.guardando = false;
        this.toast.success(`${t.name} guardado`);
        this.recargarSinSpinner();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo guardar el tema');
      },
    });
  }

  subirImagen(id: string, tipo: 'fondo' | 'logo', archivos: File[]): void {
    const archivo = archivos[0];
    if (!archivo) return;
    this.guardando = true;
    this.temas.subirImagen(id, tipo, archivo).subscribe({
      next: () => {
        this.guardando = false;
        this.toast.success(tipo === 'fondo' ? 'Fondo del login guardado' : 'Logo guardado');
        this.recargarSinSpinner();
      },
      error: (err) => {
        this.guardando = false;
        this.toast.error(err?.error?.message || 'No se pudo subir la imagen');
      },
    });
  }

  quitarImagen(id: string, tipo: 'fondo' | 'logo'): void {
    this.guardando = true;
    this.temas.quitarImagen(id, tipo).subscribe({
      next: () => {
        this.guardando = false;
        this.recargarSinSpinner();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo quitar la imagen');
      },
    });
  }

  /** Recarga el panel y vuelve a aplicar el tema de hoy en la app (por si cambió). */
  private recargarSinSpinner(): void {
    this.temas.panel().subscribe({
      next: (p) => {
        this.aplicar(p);
        this.temas.aplicar(p.actual);
      },
    });
  }
}

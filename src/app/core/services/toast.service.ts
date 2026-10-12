import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warn' | 'info';

/** Botón opcional del aviso ("Ver ticket #43"). */
export interface ToastAction {
  label: string;
  /** Ruta a la que lleva el botón (se navega con el router). */
  route?: unknown[] | string;
  queryParams?: Record<string, unknown>;
  /** O una acción libre. */
  handler?: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** Milisegundos visibles. Por defecto depende del tipo. */
  duration?: number;
}

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  action?: ToastAction;
  /** Tiempo visible en ms; lo consume la barra de progreso del contenedor. */
  duration: number;
  /** Veces que llegó el mismo aviso seguido ("×3"). */
  count: number;
  /** Cambia cada vez que se repite, para reiniciar la cuenta atrás. */
  version: number;
  /** Está saliendo: el contenedor lo anima y luego desaparece. */
  leaving: boolean;
}

/**
 * Avisos emergentes del sistema.
 *
 * <p>La firma de siempre (`success(mensaje, titulo)`) sigue funcionando; las
 * novedades van en un tercer parámetro opcional: botón de acción y duración.
 *
 * <p>La cuenta atrás no vive aquí: la lleva la barra de progreso del
 * contenedor, que se pausa al pasar el ratón y, al terminar, llama a
 * `dismiss`. Así el aviso no desaparece mientras alguien lo está leyendo.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Máximo en pantalla: más avisos a la vez no se leen, se ignoran. */
  private static readonly MAXIMO = 5;
  /** Lo que dura la animación de salida; debe coincidir con el CSS. */
  static readonly SALIDA_MS = 200;

  private counter = 0;
  private readonly _toasts = new BehaviorSubject<ToastItem[]>([]);
  readonly toasts$ = this._toasts.asObservable();

  success(message: string, title = 'Éxito', options?: ToastOptions): void {
    this.push('success', title, message, options);
  }

  error(message: string, title = 'Error', options?: ToastOptions): void {
    this.push('error', title, message, options);
  }

  warn(message: string, title = 'Atención', options?: ToastOptions): void {
    this.push('warn', title, message, options);
  }

  info(message: string, title = 'Información', options?: ToastOptions): void {
    this.push('info', title, message, options);
  }

  /** Inicia la salida animada y lo quita al terminar. */
  dismiss(id: number): void {
    const lista = this._toasts.getValue();
    const t = lista.find((x) => x.id === id);
    if (!t || t.leaving) return;
    this._toasts.next(lista.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => this.remove(id), ToastService.SALIDA_MS);
  }

  /** Quita el aviso al instante (tras un deslizamiento que ya lo sacó de la vista). */
  remove(id: number): void {
    this._toasts.next(this._toasts.getValue().filter((t) => t.id !== id));
  }

  private push(type: ToastType, title: string, message: string, options?: ToastOptions): void {
    const lista = this._toasts.getValue();
    const duration = options?.duration ?? this.duracionPorDefecto(type, !!options?.action);

    // El mismo aviso repetido no apila copias: suma un contador y reinicia su
    // cuenta atrás. Pasa con errores de red, que llegan varios a la vez.
    const igual = lista.find((t) => !t.leaving && t.type === type && t.title === title && t.message === message);
    if (igual) {
      this._toasts.next(lista.map((t) => (t.id === igual.id
        ? { ...t, count: t.count + 1, version: t.version + 1, duration }
        : t)));
      return;
    }

    const item: ToastItem = {
      id: ++this.counter,
      type,
      title,
      message,
      action: options?.action,
      duration,
      count: 1,
      version: 0,
      leaving: false,
    };
    const vivos = [...lista, item];
    // Por encima del máximo, el más antiguo sale (animado).
    const sobrantes = vivos.filter((t) => !t.leaving).length - ToastService.MAXIMO;
    this._toasts.next(vivos);
    if (sobrantes > 0) {
      vivos.filter((t) => !t.leaving).slice(0, sobrantes).forEach((t) => this.dismiss(t.id));
    }
  }

  /** Lo importante se queda más tiempo; lo que tiene botón, también. */
  private duracionPorDefecto(type: ToastType, conAccion: boolean): number {
    const base = type === 'error' ? 7000 : type === 'warn' ? 5000 : 3500;
    return conAccion ? base + 2000 : base;
  }
}

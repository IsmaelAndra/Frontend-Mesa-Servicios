import { Component, Input } from '@angular/core';
import { metaSesion, normalizarSesion, SessionState } from '../../../../core/utils/session-presence.util';

/**
 * Punto de presencia sobre un avatar. Se usa en todas las pantallas donde se
 * muestra una persona: navbar, sidebar, tarjetas de usuario, chat del ticket y
 * fichas. Antes cada una pintaba el suyo y algunas se olvidaban del punto, asi
 * que el mismo usuario aparecia con indicador en una pantalla y sin el en otra.
 *
 * Siempre se dibuja, conectado o no: si solo se pintara cuando hay sesion, en
 * la foto de un usuario desconectado no se sabria si es un fallo de carga o que
 * no esta en linea.
 */
@Component({
  selector: 'app-presence-dot',
  template: `
    <span
      class="presence-dot shrink-0"
      [ngClass]="dot"
      [title]="'Sesión: ' + etiqueta"
      [attr.aria-label]="'Sesión: ' + etiqueta"
      role="img"
    ></span>
  `
})
export class PresenceDotComponent {
  @Input() state: SessionState | string | null | undefined;

  get etiqueta(): string {
    return metaSesion(normalizarSesion(this.state)).label;
  }

  get dot(): string {
    return metaSesion(normalizarSesion(this.state)).dot;
  }
}

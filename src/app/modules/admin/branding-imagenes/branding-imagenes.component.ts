import { Component, inject } from '@angular/core';
import { BrandingComponent } from '../branding/branding.component';

/**
 * Pestaña "Imágenes": fondo del login, portada del perfil y fondos de los chats.
 *
 * <p>Era una parte de la plantilla de BrandingComponent, que llegaba a 1.800
 * líneas. El estado, la carga y el guardado siguen en BrandingComponent (una sola
 * fuente de verdad para las cuatro pestañas); aquí solo se pinta, leyendo y
 * llamando al padre como {@code b}.
 */
@Component({
  selector: 'app-branding-imagenes',
  templateUrl: './branding-imagenes.component.html',
})
export class BrandingImagenesComponent {
  /** La pantalla de imagen corporativa que contiene esta pestaña. */
  readonly b = inject(BrandingComponent);
}

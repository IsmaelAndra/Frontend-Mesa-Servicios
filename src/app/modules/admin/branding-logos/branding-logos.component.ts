import { Component, inject } from '@angular/core';
import { BrandingComponent } from '../branding/branding.component';

/**
 * Pestaña "Logos e iconos": icono del sistema, logo, logo del login e icono de los reportes.
 *
 * <p>Era una parte de la plantilla de BrandingComponent, que llegaba a 1.800
 * líneas. El estado, la carga y el guardado siguen en BrandingComponent (una sola
 * fuente de verdad para las cuatro pestañas); aquí solo se pinta, leyendo y
 * llamando al padre como {@code b}.
 */
@Component({
  selector: 'app-branding-logos',
  templateUrl: './branding-logos.component.html',
})
export class BrandingLogosComponent {
  /** La pantalla de imagen corporativa que contiene esta pestaña. */
  readonly b = inject(BrandingComponent);
}

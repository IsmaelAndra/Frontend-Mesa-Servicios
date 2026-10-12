import { Component, inject } from '@angular/core';
import { BrandingComponent } from '../branding/branding.component';

/**
 * Pestaña "Colores": editor de la paleta con vista previa en vivo.
 *
 * <p>Era una parte de la plantilla de BrandingComponent, que llegaba a 1.800
 * líneas. El estado, la carga y el guardado siguen en BrandingComponent (una sola
 * fuente de verdad para las cuatro pestañas); aquí solo se pinta, leyendo y
 * llamando al padre como {@code b}.
 */
@Component({
  selector: 'app-branding-colores',
  templateUrl: './branding-colores.component.html',
})
export class BrandingColoresComponent {
  /** La pantalla de imagen corporativa que contiene esta pestaña. */
  readonly b = inject(BrandingComponent);
}

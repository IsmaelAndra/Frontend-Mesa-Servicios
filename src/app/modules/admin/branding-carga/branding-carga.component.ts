import { Component, inject } from '@angular/core';
import { BrandingComponent } from '../branding/branding.component';

/**
 * Pestaña "Pantalla de carga": apariencia, comportamiento, estilo y vista previa.
 *
 * <p>Era una parte de la plantilla de BrandingComponent, que llegaba a 1.800
 * líneas. El estado, la carga y el guardado siguen en BrandingComponent (una sola
 * fuente de verdad para las cuatro pestañas); aquí solo se pinta, leyendo y
 * llamando al padre como {@code b}.
 */
@Component({
  selector: 'app-branding-carga',
  templateUrl: './branding-carga.component.html',
})
export class BrandingCargaComponent {
  /** La pantalla de imagen corporativa que contiene esta pestaña. */
  readonly b = inject(BrandingComponent);
}

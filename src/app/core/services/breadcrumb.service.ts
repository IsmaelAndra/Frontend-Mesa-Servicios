import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Lo que una pantalla quiere mostrar en el crumb de su URL. */
export interface EtiquetaCrumb {
  label?: string;
  icon?: string;
}

/**
 * Etiquetas del breadcrumb que dependen de los datos y no de la ruta.
 *
 * El breadcrumb se arma solo con la URL, así que en /activos/:id no sabe qué
 * activo es: mostraba "Detalle del activo" con el icono de un portátil para una
 * impresora o un servidor. La ficha del activo, que sí lo sabe, fija aquí el
 * nombre y el icono de su tipo, y los quita al salir.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly etiquetas = new BehaviorSubject<ReadonlyMap<string, EtiquetaCrumb>>(new Map());
  readonly etiquetas$ = this.etiquetas.asObservable();

  /** `url` es la del crumb, sin dominio: "/activos/<uuid>". */
  fijar(url: string, etiqueta: EtiquetaCrumb): void {
    const mapa = new Map(this.etiquetas.value);
    mapa.set(url, etiqueta);
    this.etiquetas.next(mapa);
  }

  quitar(url: string): void {
    if (!this.etiquetas.value.has(url)) return;
    const mapa = new Map(this.etiquetas.value);
    mapa.delete(url);
    this.etiquetas.next(mapa);
  }
}

import { Pipe, PipeTransform } from '@angular/core';

const ETIQUETAS_PERMITIDAS = /&lt;(\/?)(b|strong|i|em)&gt;/gi;

/** Escapa todo el texto y deja activas solo las etiquetas de énfasis, sin atributos. */
export function tituloConEnfasis(texto: string | null | undefined): string {
  const escapado = (texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escapado.replace(ETIQUETAS_PERMITIDAS, '<$1$2>');
}

/** El mismo título en texto plano, para tooltips: sin las etiquetas de énfasis. */
export function tituloSinEtiquetas(texto: string | null | undefined): string {
  return (texto ?? '').replace(/<\/?(b|strong|i|em)>/gi, '');
}

/**
 * Título de ticket para `[innerHTML]`. Hay títulos con `<b>...</b>`, que se veían
 * como texto literal. Solo pasan esas etiquetas: cualquier otra (`<img onerror>`,
 * `<script>`) sigue escapada y se muestra como texto, sin ejecutarse.
 */
@Pipe({ name: 'tituloEnfasis', pure: true })
export class TituloEnfasisPipe implements PipeTransform {
  transform(texto: string | null | undefined): string {
    return tituloConEnfasis(texto);
  }
}

@Pipe({ name: 'tituloPlano', pure: true })
export class TituloPlanoPipe implements PipeTransform {
  transform(texto: string | null | undefined): string {
    return tituloSinEtiquetas(texto);
  }
}

/**
 * Arrastrar tarjetas (tickets, actividades, proyectos) solo con ratón.
 * En un teléfono o tableta el dedo que desliza para recorrer el tablero
 * agarraba la tarjeta y la movía de columna; ahí se cambia con el menú o el modal.
 */
export function arrastreHabilitado(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return !window.matchMedia('(hover: none) and (pointer: coarse)').matches
    && !window.matchMedia('(max-width: 767px)').matches;
}

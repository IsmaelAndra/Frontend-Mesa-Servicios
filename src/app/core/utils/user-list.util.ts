/**
 * Orden de las listas de personas.
 *
 * El backend devuelve los usuarios sin `ORDER BY`, asi que PostgreSQL los entrega
 * en orden fisico: cuando a alguien se le sube la foto su fila se actualiza y
 * salta al final. En un desplegable de asignacion eso se ve como "los que tienen
 * foto juntos delante y los demas detras", que es un grouping que no existe.
 *
 * Aqui se ordena por nombre para que la lista sea siempre la misma y se pueda
 * buscar a alguien por donde le toca en el alfabeto.
 */
export function compararPorNombre(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}

/** Nombre por el que se muestra y se ordena a una persona. */
export function nombreVisible(usuario: { displayName?: string; corporateEmailUser?: string }): string {
  return usuario.displayName?.trim() || usuario.corporateEmailUser || '';
}
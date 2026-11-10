/** Un bloque de avisos bajo un mismo encabezado de fecha. */
export interface GrupoPorFecha<T> {
  label: string;
  items: T[];
}

/**
 * Reparte una lista (ya ordenada de la más nueva a la más vieja) en
 * "Hoy", "Ayer", "Últimos 7 días" y "Anteriores", según la fecha local.
 * Los grupos vacíos no se devuelven.
 */
export function agruparPorFecha<T>(
  items: T[] | null | undefined,
  fechaDe: (item: T) => string | Date | null | undefined,
  ahora: Date = new Date(),
): GrupoPorFecha<T>[] {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const semana = new Date(hoy);
  semana.setDate(semana.getDate() - 7);

  const grupos: GrupoPorFecha<T>[] = [
    { label: 'Hoy', items: [] },
    { label: 'Ayer', items: [] },
    { label: 'Últimos 7 días', items: [] },
    { label: 'Anteriores', items: [] },
  ];
  (items || []).forEach((item) => {
    const valor = fechaDe(item);
    const t = valor ? new Date(valor).getTime() : NaN;
    const i = isNaN(t) ? 3 : t >= hoy.getTime() ? 0 : t >= ayer.getTime() ? 1 : t >= semana.getTime() ? 2 : 3;
    grupos[i].items.push(item);
  });
  return grupos.filter((g) => g.items.length > 0);
}

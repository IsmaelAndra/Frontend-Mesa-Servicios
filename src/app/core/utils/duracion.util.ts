/**
 * Minutos en texto legible: 30 → "30 min", 90 → "1 h 30 min", 240 → "4 h",
 * 2880 → "2 d". Los plazos de SLA se guardan en minutos, pero "2880 min" obliga
 * a hacer la cuenta para saber que son dos días.
 *
 * Solo se muestran las dos unidades mayores: "1 d 2 h" y no "1 d 2 h 5 min",
 * que es más preciso pero se lee peor en una tabla.
 */
export function duracionLegible(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos) || minutos <= 0) {
    return '—';
  }
  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;

  const dias = Math.floor(total / 1440);
  const horas = Math.floor((total % 1440) / 60);
  const mins = total % 60;

  if (dias > 0) return horas ? `${dias} d ${horas} h` : `${dias} d`;
  return mins ? `${horas} h ${mins} min` : `${horas} h`;
}

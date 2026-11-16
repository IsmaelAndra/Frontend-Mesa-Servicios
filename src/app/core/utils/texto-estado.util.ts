/**
 * Estado guardado en mayúsculas ("EN_PROCESO") → texto para leer ("En proceso").
 * Para catálogos con nombre propio (activos, workflows) se usan sus metas.
 */
export function textoEstado(valor: string | null | undefined): string {
  const v = (valor || '').trim();
  if (!v) return '';
  const t = v.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

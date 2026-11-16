/** Escapa texto para meterlo en HTML armado a mano (p. ej. el html de un Swal). */
export function escaparHtml(v: string | null | undefined): string {
  return (v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

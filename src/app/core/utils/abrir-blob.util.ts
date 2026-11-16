/**
 * Abre un archivo recibido como Blob (PDF del acta, etiquetas, fotos) en una
 * pestaña nueva; si el navegador lo bloquea, lo descarga con su nombre.
 * Los archivos de activos nunca tienen URL pública: llegan por la API con la
 * sesión, así que no se puede enlazar directo.
 */
export function abrirBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, '_blank');
  if (!ventana) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Tiempo de sobra para que la pestaña lo cargue.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Tamaño legible: 1,2 MB, 350 KB. */
export function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

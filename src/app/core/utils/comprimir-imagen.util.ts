/**
 * Reduce una foto antes de subirla: la de un teléfono pesa 3–8 MB y tarda en subir
 * por la VPN. Se redimensiona a `maxLado` px por el lado mayor y se guarda en JPEG.
 * Si el navegador no puede (formato raro, sin canvas) o el resultado pesa más,
 * se devuelve el archivo original: comprimir nunca debe impedir subir la foto.
 */
export async function comprimirImagen(archivo: File, maxLado = 1600, calidad = 0.8): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || typeof createImageBitmap !== 'function') {
    return archivo;
  }
  try {
    // 'from-image' respeta la orientación EXIF (fotos de teléfono giradas).
    const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const ancho = Math.round(bmp.width * escala);
    const alto = Math.round(bmp.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return archivo;
    }
    // Fondo blanco: un PNG con transparencia saldría negro en JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bmp, 0, 0, ancho, alto);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', calidad));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return archivo;
  }
}

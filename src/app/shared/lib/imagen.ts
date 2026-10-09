/**
 * Preparacion de fotos de evidencia en el navegador, antes de subirlas.
 * Re-codificar en un canvas descarta todos los metadatos EXIF, incluida la
 * ubicacion GPS, y reduce el peso para que suban con señal debil.
 */

export interface OpcionesImagen {
  readonly ladoMaximo: number;
  readonly calidad: number;
}

export const OPCIONES_EVIDENCIA: OpcionesImagen = { ladoMaximo: 1280, calidad: 0.78 };

export function calcularDimensiones(ancho: number, alto: number, ladoMaximo: number): { ancho: number; alto: number } {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) };
}

export async function prepararFoto(archivo: File, opciones: OpcionesImagen = OPCIONES_EVIDENCIA): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height, opciones.ladoMaximo);
  const canvas = new OffscreenCanvas(ancho, alto);
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('El navegador no permite procesar imágenes.');
  contexto.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: opciones.calidad });
}

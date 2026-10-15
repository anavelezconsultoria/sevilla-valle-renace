/**
 * Cabecitas de quienes ayudan: inicial y un color estable por nombre, para que
 * la misma persona se vea igual en el mapa, en el boton y en las listas.
 */
const COLORES = ['#6a4fe0', '#2b4cf2', '#4a3fe0', '#8b5cf6', '#3b3a6b', '#5b6cf0', '#7c5cf0', '#2a2766'] as const;

export interface Avatar {
  readonly inicial: string;
  readonly color: string;
  readonly nombre: string;
}

function hashTexto(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarDe(nombre: string): Avatar {
  const limpio = nombre.trim();
  return {
    nombre: limpio,
    inicial: limpio.charAt(0).toUpperCase() || '?',
    color: COLORES[hashTexto(limpio.toLowerCase()) % COLORES.length],
  };
}

/** Escapa texto para meterlo en HTML armado a mano (marcadores de Leaflet). */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

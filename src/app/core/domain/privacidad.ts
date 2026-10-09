import { Coordenada } from './necesidad.model';

const METROS_POR_GRADO_LAT = 111_320;
export const DESPLAZAMIENTO_MIN_M = 150;
export const DESPLAZAMIENTO_MAX_M = 300;

/** Fuente de azar inyectable para que el desplazamiento sea probable en pruebas. */
export type Aleatorio = () => number;

/**
 * Desplaza una coordenada entre 150 y 300 metros en una direccion al azar.
 * El punto publico nunca debe permitir llegar a la puerta de una familia.
 */
export function desplazarCoordenada(origen: Coordenada, aleatorio: Aleatorio = Math.random): Coordenada {
  const distancia = DESPLAZAMIENTO_MIN_M + aleatorio() * (DESPLAZAMIENTO_MAX_M - DESPLAZAMIENTO_MIN_M);
  const angulo = aleatorio() * 2 * Math.PI;
  const metrosPorGradoLng = METROS_POR_GRADO_LAT * Math.cos((origen.lat * Math.PI) / 180);
  return {
    lat: origen.lat + (distancia * Math.cos(angulo)) / METROS_POR_GRADO_LAT,
    lng: origen.lng + (distancia * Math.sin(angulo)) / metrosPorGradoLng,
  };
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Codigo de seguimiento legible: sin 0/O ni 1/I para dictarlo por telefono sin errores. */
export function generarCodigoSeguimiento(aleatorio: Aleatorio = Math.random): string {
  const bloque = (): string =>
    Array.from({ length: 4 }, () => ALFABETO_CODIGO[Math.floor(aleatorio() * ALFABETO_CODIGO.length)]).join('');
  return `${bloque()}-${bloque()}`;
}

export function normalizarCodigo(entrada: string): string {
  const limpio = entrada.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpio.length === 8 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

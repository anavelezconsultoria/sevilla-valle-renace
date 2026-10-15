import * as L from 'leaflet';
import { Coordenada, EstadoNecesidad } from '../../core/domain/necesidad.model';
import { CategoriaInfo, CENTRO_SEVILLA, COLOR_ESTADO } from '../../core/domain/catalogos';
import { avatarDe, escaparHtml } from '../lib/avatar';

/** Fabrica del mapa base y de los marcadores, compartida por el mapa publico y el selector de punto. */

const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const ZOOM_INICIAL = 14;

export interface OpcionesMapa {
  readonly centro?: Coordenada;
  readonly zoom?: number;
}

export function crearMapa(contenedor: HTMLElement, { centro = CENTRO_SEVILLA, zoom = ZOOM_INICIAL }: OpcionesMapa = {}): L.Map {
  const mapa = L.map(contenedor, { zoomControl: false, attributionControl: true }).setView([centro.lat, centro.lng], zoom);
  L.tileLayer(TESELAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  return mapa;
}

/**
 * Marcador: el COLOR dice el estado (semaforo, igual que la leyenda) y el ICONO dice
 * la categoria. Antes el color era la categoria y se confundia con los estados.
 */
export interface MarcadorNecesidad {
  readonly categoria: CategoriaInfo;
  readonly estado: EstadoNecesidad;
  readonly seleccionado: boolean;
  /** Posicion en la lista: escalona la caida de los pines la primera vez que se pintan. */
  readonly orden: number;
  readonly animar: boolean;
  /** Esperando ayuda: el pin late suave para invitar a atenderla. */
  readonly esperando: boolean;
  /** Urgente y sin atender: late mas fuerte para que el ojo vaya primero ahi. */
  readonly urgente: boolean;
  /** Quien la esta llevando: su cabecita aparece sobre el pin (red solidaria). */
  readonly ayudante?: string;
}

export function iconoNecesidad({ categoria, estado, seleccionado, orden, animar, esperando, urgente, ayudante }: MarcadorNecesidad): L.DivIcon {
  const color = COLOR_ESTADO[estado];
  const tamano = seleccionado ? 46 : 38;
  const latido = urgente ? 'sr-pin--urgente' : esperando ? 'sr-pin--espera' : '';
  const clases = ['sr-pin', seleccionado ? 'sr-pin--activo' : '', animar ? 'sr-pin--cae' : '', latido].join(' ');
  const html = `
    <div class="sr-pin-caja" style="--pin:${color};--anillo:#ffffff;--t:${tamano}px;--i:${orden}">
      <div class="${clases}">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${categoria.icono}"/></svg>
      </div>
      ${ayudante ? cabecita(ayudante) : ''}
    </div>`;
  return L.divIcon({ html, className: 'sr-pin-wrap', iconSize: [tamano, tamano], iconAnchor: [tamano / 2, tamano] });
}

function cabecita(nombre: string): string {
  const { inicial, color } = avatarDe(nombre);
  const titulo = escaparHtml(`La está llevando ${nombre}`);
  return `<span class="sr-pin-avatar" style="--av:${color}" title="${titulo}">${escaparHtml(inicial)}</span>`;
}

export function iconoPuntoElegido(): L.DivIcon {
  return L.divIcon({
    html: '<div class="sr-elegido"></div>',
    className: 'sr-pin-wrap',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

import * as L from 'leaflet';
import { Coordenada, EstadoNecesidad } from '../../core/domain/necesidad.model';
import { CategoriaInfo, CENTRO_SEVILLA } from '../../core/domain/catalogos';

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

const ANILLO_POR_ESTADO: Partial<Record<EstadoNecesidad, string>> = {
  [EstadoNecesidad.EnAtencion]: '#2b4cf2',
  [EstadoNecesidad.Entregada]: '#7c5cf0',
  [EstadoNecesidad.Atendida]: '#1b8a5e',
};

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
}

export function iconoNecesidad({ categoria, estado, seleccionado, orden, animar, esperando, urgente }: MarcadorNecesidad): L.DivIcon {
  const anillo = ANILLO_POR_ESTADO[estado] ?? '#ffffff';
  const tamano = seleccionado ? 46 : 38;
  const latido = urgente ? 'sr-pin--urgente' : esperando ? 'sr-pin--espera' : '';
  const clases = ['sr-pin', seleccionado ? 'sr-pin--activo' : '', animar ? 'sr-pin--cae' : '', latido].join(' ');
  const html = `
    <div class="${clases}" style="--pin:${categoria.color};--anillo:${anillo};--t:${tamano}px;--i:${orden}">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${categoria.icono}"/></svg>
    </div>`;
  return L.divIcon({ html, className: 'sr-pin-wrap', iconSize: [tamano, tamano], iconAnchor: [tamano / 2, tamano] });
}

export function iconoPuntoElegido(): L.DivIcon {
  return L.divIcon({
    html: '<div class="sr-elegido"></div>',
    className: 'sr-pin-wrap',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

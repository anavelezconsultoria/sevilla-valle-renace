import {
  Categoria,
  CierreAtencion,
  ContactoPrivado,
  EstadoNecesidad,
  EventoNecesidad,
  Necesidad,
  TipoEvento,
  Urgencia,
} from '../../core/domain/necesidad.model';

/** Forma de las filas que devuelve la API de Supabase (snake_case, tal cual la base). */

export interface FilaEvidencia {
  readonly id: string;
  readonly ruta: string;
}

export interface FilaEvento {
  readonly id: string;
  readonly tipo: TipoEvento;
  readonly ocurrido_en: string;
  readonly actor_alias: string;
  readonly nota: string | null;
  readonly evidencias: readonly FilaEvidencia[];
}

export interface FilaNecesidad {
  readonly id: string;
  readonly categoria: Categoria;
  readonly titulo: string;
  readonly descripcion: string;
  readonly urgencia: Urgencia;
  readonly personas_hogar: number;
  readonly sector: string;
  readonly lat_aprox: number;
  readonly lng_aprox: number;
  readonly estado: EstadoNecesidad;
  readonly cierre: CierreAtencion | null;
  readonly ayudante_id: string | null;
  readonly registrada_en: string;
  readonly actualizada_en: string;
  readonly vence_en: string | null;
  readonly ayudante: { readonly alias: string } | null;
  readonly eventos: readonly FilaEvento[];
}

export interface FilaContacto {
  readonly nombre: string;
  readonly telefono: string;
  readonly lat: number;
  readonly lng: number;
  readonly referencias: string;
}

export interface FilaRegistro {
  readonly necesidad_id: string;
  readonly codigo: string;
}

export interface FilaPerfil {
  readonly id: string;
  readonly alias: string;
}

/** Columnas y relaciones que se piden: solo datos publicos. */
export const SELECT_NECESIDADES = [
  'id, categoria, titulo, descripcion, urgencia, personas_hogar, sector, lat_aprox, lng_aprox',
  'estado, cierre, ayudante_id, registrada_en, actualizada_en, vence_en',
  'ayudante:perfiles(alias)',
  'eventos:eventos_necesidad(id, tipo, ocurrido_en, actor_alias, nota, evidencias(id, ruta))',
].join(', ');

export type UrlPublica = (ruta: string) => string;

function aEvento(fila: FilaEvento, urlPublica: UrlPublica): EventoNecesidad {
  return {
    id: fila.id,
    tipo: fila.tipo,
    ocurridoEn: fila.ocurrido_en,
    actor: fila.actor_alias,
    nota: fila.nota ?? undefined,
    evidencias: fila.evidencias.map((e) => ({ id: e.id, url: urlPublica(e.ruta), descripcion: 'Evidencia de entrega' })),
  };
}

export function aNecesidad(fila: FilaNecesidad, urlPublica: UrlPublica): Necesidad {
  return {
    id: fila.id,
    categoria: fila.categoria,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    urgencia: fila.urgencia,
    personasHogar: fila.personas_hogar,
    sector: fila.sector,
    ubicacionAproximada: { lat: fila.lat_aprox, lng: fila.lng_aprox },
    estado: fila.estado,
    cierre: fila.cierre ?? undefined,
    ayudanteId: fila.ayudante_id ?? undefined,
    ayudanteAlias: fila.ayudante?.alias,
    registradaEn: fila.registrada_en,
    actualizadaEn: fila.actualizada_en,
    venceEn: fila.vence_en ?? undefined,
    eventos: fila.eventos
      .map((e) => aEvento(e, urlPublica))
      .toSorted((a, b) => new Date(a.ocurridoEn).getTime() - new Date(b.ocurridoEn).getTime()),
  };
}

export function aContacto(fila: FilaContacto): ContactoPrivado {
  return {
    nombre: fila.nombre,
    telefono: fila.telefono,
    referencias: fila.referencias,
    ubicacionExacta: { lat: fila.lat, lng: fila.lng },
  };
}

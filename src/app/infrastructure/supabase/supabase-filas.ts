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
import {
  AtencionEnCurso,
  ErrorRegistrado,
  Ayudante,
  HistorialCelular,
  HogarAtendido,
  SolicitudEnRevision,
  VecinoQueAyuda,
  ReportePendiente,
} from '../../core/ports/necesidades.ports';
import { MotivoReporte } from '../../core/domain/reporte-mal-uso';

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
  readonly prioridad_cero: boolean;
  readonly primera_solicitud: boolean;
  readonly ayuda_reciente_categoria: Categoria | null;
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
  /** RLS solo devuelve las fotos (los videos son privados). */
  readonly adjuntos: readonly { readonly ruta: string }[];
}

export interface FilaContacto {
  readonly nombre: string;
  readonly telefono: string;
  readonly lat: number;
  readonly lng: number;
  readonly referencias: string;
}

export interface FilaRegistro {
  /** Nulo cuando el celular ya tiene otra clave (codigo = 'clave_no_coincide'). */
  readonly necesidad_id: string | null;
  readonly codigo: string;
}

export interface FilaPerfil {
  readonly id: string;
  readonly alias: string;
  readonly rol: 'ayudante' | 'coordinacion';
}

export function aAyudante(fila: FilaPerfil): Ayudante {
  return { id: fila.id, alias: fila.alias, esCoordinador: fila.rol === 'coordinacion' };
}

/** Columnas y relaciones que se piden: solo datos publicos. */
export const SELECT_NECESIDADES = [
  'id, categoria, titulo, descripcion, urgencia, personas_hogar, prioridad_cero, primera_solicitud, ayuda_reciente_categoria, sector, lat_aprox, lng_aprox',
  'estado, cierre, ayudante_id, registrada_en, actualizada_en, vence_en',
  'ayudante:perfiles(alias)',
  'eventos:eventos_necesidad(id, tipo, ocurrido_en, actor_alias, nota, evidencias(id, ruta))',
  'adjuntos:adjuntos_solicitud(ruta)',
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

export function aNecesidad(fila: FilaNecesidad, urlPublica: UrlPublica, urlFoto: UrlPublica): Necesidad {
  return {
    id: fila.id,
    categoria: fila.categoria,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    urgencia: fila.urgencia,
    personasHogar: fila.personas_hogar,
    prioridadCero: fila.prioridad_cero,
    primeraSolicitud: fila.primera_solicitud,
    ayudaRecienteCategoria: fila.ayuda_reciente_categoria ?? undefined,
    sector: fila.sector,
    ubicacionAproximada: { lat: fila.lat_aprox, lng: fila.lng_aprox },
    estado: fila.estado,
    cierre: fila.cierre ?? undefined,
    ayudanteId: fila.ayudante_id ?? undefined,
    ayudanteAlias: fila.ayudante?.alias,
    registradaEn: fila.registrada_en,
    actualizadaEn: fila.actualizada_en,
    venceEn: fila.vence_en ?? undefined,
    fotos: (fila.adjuntos ?? []).map((a) => urlFoto(a.ruta)),
    eventos: fila.eventos
      .map((e) => aEvento(e, urlPublica))
      .sort((a, b) => new Date(a.ocurridoEn).getTime() - new Date(b.ocurridoEn).getTime()),
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

export interface FilaRevision {
  readonly necesidad_id: string;
  readonly titulo: string;
  readonly categoria: Categoria;
  readonly sector: string;
  readonly registrada_en: string;
  readonly nombre: string;
  readonly telefono: string;
  readonly motivo: string;
}

export function aSolicitudEnRevision(fila: FilaRevision): SolicitudEnRevision {
  return {
    necesidadId: fila.necesidad_id,
    titulo: fila.titulo,
    categoria: fila.categoria,
    sector: fila.sector,
    registradaEn: fila.registrada_en,
    nombre: fila.nombre,
    telefono: fila.telefono,
    motivo: fila.motivo,
  };
}

/** JSON que devuelve historial_celular (snake_case, tal cual la base). */
export interface FilaHistorial {
  readonly solicitudes: readonly {
    readonly id: string;
    readonly titulo: string;
    readonly categoria: Categoria;
    readonly estado: EstadoNecesidad;
    readonly nombre: string;
    readonly sector: string;
    readonly registrada_en: string;
    readonly entregada_en: string | null;
    readonly ayudante: string | null;
    readonly motivo_revision: string | null;
  }[];
  readonly parecidas: readonly { readonly telefono: string; readonly nombre: string; readonly sector: string; readonly solicitudes: number }[];
  readonly ayudante: {
    readonly alias: string;
    readonly tomadas: number;
    readonly entregas: number;
    readonly liberadas: number;
    readonly vencidas: number;
  } | null;
}

export function aHistorial(fila: FilaHistorial): HistorialCelular {
  return {
    solicitudes: fila.solicitudes.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      categoria: s.categoria,
      estado: s.estado,
      nombre: s.nombre,
      sector: s.sector,
      registradaEn: s.registrada_en,
      entregadaEn: s.entregada_en ?? undefined,
      ayudante: s.ayudante ?? undefined,
      motivoRevision: s.motivo_revision ?? undefined,
    })),
    parecidas: fila.parecidas.map((p) => ({ ...p })),
    ayudante: fila.ayudante ?? undefined,
  };
}

export interface FilaVecino {
  readonly alias: string;
  readonly entregas: number;
  readonly ultima_entrega: string;
}

export function aVecino(fila: FilaVecino): VecinoQueAyuda {
  return { alias: fila.alias, entregas: Number(fila.entregas), ultimaEntrega: fila.ultima_entrega };
}

export interface FilaHogarAtendido {
  readonly telefono: string;
  readonly nombre: string;
  readonly sector: string;
  readonly ayudas: number;
  readonly ultima_ayuda: string;
  readonly categorias: readonly Categoria[];
}

export function aHogarAtendido(fila: FilaHogarAtendido): HogarAtendido {
  return {
    telefono: fila.telefono,
    nombre: fila.nombre,
    sector: fila.sector,
    ayudas: Number(fila.ayudas),
    ultimaAyuda: fila.ultima_ayuda,
    categorias: fila.categorias,
  };
}

export interface FilaAtencionEnCurso {
  readonly necesidad_id: string;
  readonly titulo: string;
  readonly categoria: Categoria;
  readonly sector: string;
  readonly prioridad_cero: boolean;
  readonly tomada_en: string | null;
  readonly vence_en: string | null;
  readonly ayudante_alias: string;
  readonly ayudante_celular: string | null;
}

export function aAtencionEnCurso(fila: FilaAtencionEnCurso): AtencionEnCurso {
  return {
    necesidadId: fila.necesidad_id,
    titulo: fila.titulo,
    categoria: fila.categoria,
    sector: fila.sector,
    prioridadCero: fila.prioridad_cero,
    tomadaEn: fila.tomada_en ?? undefined,
    venceEn: fila.vence_en ?? undefined,
    ayudanteAlias: fila.ayudante_alias,
    ayudanteCelular: fila.ayudante_celular ?? undefined,
  };
}

export interface FilaErrorRegistrado {
  readonly mensaje: string;
  readonly ruta: string;
  readonly navegador: string;
  readonly version: string;
  readonly veces: number;
  readonly primera_vez: string;
  readonly ultima_vez: string;
}

export function aErrorRegistrado(fila: FilaErrorRegistrado): ErrorRegistrado {
  return {
    mensaje: fila.mensaje,
    ruta: fila.ruta,
    navegador: fila.navegador,
    version: fila.version,
    veces: fila.veces,
    primeraVez: fila.primera_vez,
    ultimaVez: fila.ultima_vez,
  };
}

export interface FilaReporte {
  readonly necesidad_id: string;
  readonly titulo: string;
  readonly categoria: Categoria;
  readonly sector: string;
  readonly estado: EstadoNecesidad;
  readonly nombre: string;
  readonly telefono: string;
  readonly reportes: number;
  readonly motivos: readonly MotivoReporte[];
  readonly notas: readonly string[] | null;
  readonly ultimo: string;
}

export function aReportePendiente(fila: FilaReporte): ReportePendiente {
  return {
    necesidadId: fila.necesidad_id,
    titulo: fila.titulo,
    categoria: fila.categoria,
    sector: fila.sector,
    estado: fila.estado,
    nombre: fila.nombre,
    telefono: fila.telefono,
    reportes: Number(fila.reportes),
    motivos: fila.motivos,
    notas: fila.notas ?? [],
    ultimo: fila.ultimo,
  };
}

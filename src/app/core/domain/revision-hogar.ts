import { Categoria, EstadoNecesidad, Necesidad, TipoEvento } from './necesidad.model';
import { infoCategoria } from './catalogos';
import { ultimo } from './listas';

/**
 * Reglas para repartir mejor la ayuda. En produccion las aplica la base
 * (migracion 0016, _motivo_revision); esta es la misma regla para el modo demo.
 * Deben mantenerse iguales.
 */
export const DIAS_AYUDA_RECIENTE = 7;
export const DIAS_MISMA_CATEGORIA = 15;
const AYUDAS_RECIENTES_PARA_REVISAR = 2;
const MS_POR_DIA = 86_400_000;

const ESTADOS_SIN_CERRAR: readonly EstadoNecesidad[] = [
  EstadoNecesidad.Registrada,
  EstadoNecesidad.EnRevision,
  EstadoNecesidad.EnAtencion,
  EstadoNecesidad.Entregada,
];

export interface AyudaRecibida {
  readonly categoria: Categoria;
  readonly entregadaEn: Date;
}

export interface ConsultaRevision {
  readonly categoria: Categoria;
  /** Todas las solicitudes anteriores del mismo celular. */
  readonly delHogar: readonly Necesidad[];
  readonly ahora: Date;
}

/** Ayudas que ya le llegaron al hogar: solicitudes con entrega registrada. */
export function ayudasRecibidas(delHogar: readonly Necesidad[]): readonly AyudaRecibida[] {
  return delHogar
    .filter((n) => n.estado === EstadoNecesidad.Entregada || n.estado === EstadoNecesidad.Atendida)
    .flatMap((n) => {
      const entrega = ultimo(n.eventos, (e) => e.tipo === TipoEvento.Entregada);
      return entrega ? [{ categoria: n.categoria, entregadaEn: new Date(entrega.ocurridoEn) }] : [];
    });
}

function diasDesde(fecha: Date, ahora: Date): number {
  return Math.floor((ahora.getTime() - fecha.getTime()) / MS_POR_DIA);
}

function hace(dias: number): string {
  if (dias === 0) return 'menos de un día';
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** Por que una solicitud nueva debe revisarse, o undefined si se publica directo. */
export function motivoRevision({ categoria, delHogar, ahora }: ConsultaRevision): string | undefined {
  const nombre = infoCategoria(categoria).etiqueta.toLowerCase();
  if (delHogar.some((n) => n.categoria === categoria && ESTADOS_SIN_CERRAR.includes(n.estado))) {
    return `Ya tiene otra solicitud de ${nombre} sin cerrar.`;
  }
  const recibidas = ayudasRecibidas(delHogar);
  const mismaCategoria = recibidas
    .filter((a) => a.categoria === categoria && diasDesde(a.entregadaEn, ahora) < DIAS_MISMA_CATEGORIA)
    .map((a) => diasDesde(a.entregadaEn, ahora));
  if (mismaCategoria.length) return `Recibió ${nombre} hace ${hace(Math.min(...mismaCategoria))}.`;
  const recientes = recibidas.filter((a) => diasDesde(a.entregadaEn, ahora) < DIAS_AYUDA_RECIENTE).length;
  return recientes >= AYUDAS_RECIENTES_PARA_REVISAR ? `Recibió ${recientes} ayudas en los últimos 7 días.` : undefined;
}

/** Categoria de la ayuda mas reciente que recibio el hogar en 7 dias (senal publica neutra). */
export function ayudaReciente(delHogar: readonly Necesidad[], ahora: Date): Categoria | undefined {
  return ayudasRecibidas(delHogar)
    .filter((a) => diasDesde(a.entregadaEn, ahora) < DIAS_AYUDA_RECIENTE)
    .sort((a, b) => b.entregadaEn.getTime() - a.entregadaEn.getTime())[0]?.categoria;
}

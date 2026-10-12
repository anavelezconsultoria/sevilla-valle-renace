import { EstadoNecesidad, Necesidad, TipoEvento } from './necesidad.model';

/**
 * Reglas del ciclo de vida. El backend las aplica de verdad (funciones de la
 * base); aqui se replican solo para que la UI muestre las acciones posibles.
 */

export const HORAS_PARA_ENTREGAR = 48;
export const HORAS_PARA_CONFIRMAR = 48;
/** Horas extra que puede pedir quien atiende, una vez por toma. */
export const HORAS_EXTRA = 24;
/** Desde cuantas horas antes del vencimiento se avisa a quien atiende. */
export const HORAS_AVISO_VENCIMIENTO = 12;

/** Horas que faltan para que venza la etapa actual (negativo si ya vencio). */
export function horasRestantes(venceEn: string | undefined, ahora: Date = new Date()): number | null {
  return venceEn ? (new Date(venceEn).getTime() - ahora.getTime()) / 3_600_000 : null;
}

/** Solo se puede pedir mas tiempo una vez desde la ultima vez que se tomo. */
export function puedeExtenderPlazo(n: Necesidad): boolean {
  if (n.estado !== EstadoNecesidad.EnAtencion) return false;
  const ultimaToma = n.eventos.findLastIndex((e) => e.tipo === TipoEvento.Tomada);
  return !n.eventos.slice(ultimaToma + 1).some((e) => e.tipo === TipoEvento.PlazoExtendido);
}

export type AccionAyudante = 'tomar' | 'liberar' | 'entregar';
export type AccionSolicitante = 'confirmar' | 'no_recibida' | 'cancelar';

const ACCIONES_SOLICITANTE: Record<EstadoNecesidad, readonly AccionSolicitante[]> = {
  [EstadoNecesidad.Registrada]: ['cancelar'],
  [EstadoNecesidad.EnAtencion]: [],
  [EstadoNecesidad.Entregada]: ['confirmar', 'no_recibida'],
  [EstadoNecesidad.Atendida]: [],
  [EstadoNecesidad.Cancelada]: [],
};

export function accionesDelSolicitante(estado: EstadoNecesidad): readonly AccionSolicitante[] {
  return ACCIONES_SOLICITANTE[estado];
}

export interface ContextoAyudante {
  readonly estado: EstadoNecesidad;
  readonly esAsignado: boolean;
}

export function accionesDelAyudante({ estado, esAsignado }: ContextoAyudante): readonly AccionAyudante[] {
  if (estado === EstadoNecesidad.Registrada) return ['tomar'];
  if (estado === EstadoNecesidad.EnAtencion && esAsignado) return ['entregar', 'liberar'];
  return [];
}

export const ESTADOS_ACTIVOS: readonly EstadoNecesidad[] = [
  EstadoNecesidad.Registrada,
  EstadoNecesidad.EnAtencion,
  EstadoNecesidad.Entregada,
];

export function horasDesde(iso: string, ahora: Date = new Date()): number {
  return (ahora.getTime() - new Date(iso).getTime()) / 3_600_000;
}

export function sumarHoras(iso: string, horas: number): string {
  return new Date(new Date(iso).getTime() + horas * 3_600_000).toISOString();
}

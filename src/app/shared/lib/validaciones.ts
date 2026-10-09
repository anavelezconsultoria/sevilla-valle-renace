/**
 * Reglas de largo identicas a las restricciones CHECK de la base: miden el
 * texto sin espacios al inicio ni al final (btrim). Si el cliente y la base
 * midieran distinto, un dato pasaria el formulario y fallaria al guardar.
 */

export interface ErrorValidacion {
  readonly kind: string;
  readonly message: string;
}

export interface ReglaLargo {
  readonly min: number;
  readonly max: number;
  readonly vacio: string;
  readonly corto: string;
}

export function validarLargo(valor: string, regla: ReglaLargo): ErrorValidacion | null {
  const largo = valor.trim().length;
  if (largo === 0) return { kind: 'requerido', message: regla.vacio };
  if (largo < regla.min) return { kind: 'corto', message: regla.corto };
  if (largo > regla.max) return { kind: 'largo', message: `Máximo ${regla.max} caracteres.` };
  return null;
}

/** Limites de la base (migracion 0001). Un solo lugar para no desincronizarlos. */
export const LARGOS = {
  titulo: { min: 3, max: 80, vacio: 'Escribe en pocas palabras qué necesitas.', corto: 'Escribe al menos 3 letras.' },
  descripcion: { min: 15, max: 600, vacio: 'Cuéntanos un poco más.', corto: 'Agrega un poco más de detalle (mínimo 15 caracteres).' },
  sector: { min: 2, max: 80, vacio: 'Escribe tu barrio, vereda o corregimiento.', corto: 'Escribe al menos 2 letras.' },
  nombre: { min: 2, max: 80, vacio: 'Escribe un nombre para contactarte.', corto: 'El nombre debe tener al menos 2 letras.' },
} as const satisfies Record<string, ReglaLargo>;

export const MAX_REFERENCIAS = 200;

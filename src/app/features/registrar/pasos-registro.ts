/** Pasos del asistente para pedir ayuda: una pregunta por pantalla. */

export type PasoRegistro = 'categoria' | 'urgencia' | 'detalle' | 'ubicacion' | 'contacto' | 'clave' | 'revision';

export interface DefinicionPaso {
  readonly id: PasoRegistro;
  readonly titulo: string;
  readonly corto: string;
}

export const PASOS: readonly DefinicionPaso[] = [
  { id: 'categoria', titulo: '¿Qué necesitas?', corto: 'Qué' },
  { id: 'urgencia', titulo: '¿Qué tan urgente es?', corto: 'Urgencia' },
  { id: 'detalle', titulo: 'Cuéntanos un poco más', corto: 'Detalle' },
  { id: 'ubicacion', titulo: '¿Dónde estás?', corto: 'Dónde' },
  { id: 'contacto', titulo: '¿Cómo te contactamos?', corto: 'Contacto' },
  { id: 'clave', titulo: 'Crea tu clave de 4 números', corto: 'Clave' },
  { id: 'revision', titulo: 'Revisa y envía', corto: 'Enviar' },
];

export const MAX_PERSONAS_DIBUJADAS = 10;

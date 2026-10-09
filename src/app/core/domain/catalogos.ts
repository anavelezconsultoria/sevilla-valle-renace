import { Categoria, EstadoNecesidad, TipoEvento, Urgencia } from './necesidad.model';

/** Textos y apariencia de cada valor de dominio. Un solo lugar para el vocabulario de la UI. */

export interface CategoriaInfo {
  readonly valor: Categoria;
  readonly etiqueta: string;
  readonly icono: string;
  readonly color: string;
}

export const CATEGORIAS: readonly CategoriaInfo[] = [
  { valor: Categoria.Alimentos, etiqueta: 'Alimentos', icono: 'M5 11h14l-1.5 8h-11zM8 11V7a4 4 0 0 1 8 0v4', color: '#c2612c' },
  { valor: Categoria.Agua, etiqueta: 'Agua', icono: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z', color: '#2e6f9e' },
  { valor: Categoria.Techo, etiqueta: 'Techo / albergue', icono: 'M3 11l9-7 9 7M5 10v10h14V10', color: '#8a5a3b' },
  { valor: Categoria.Salud, etiqueta: 'Salud', icono: 'M12 5v14M5 12h14', color: '#b23a32' },
  { valor: Categoria.Medicamentos, etiqueta: 'Medicamentos', icono: 'M8.5 15.5l7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5zM7 9l8 8', color: '#94395f' },
  { valor: Categoria.Ropa, etiqueta: 'Ropa y cobijas', icono: 'M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8z', color: '#3f7f86' },
  { valor: Categoria.Aseo, etiqueta: 'Aseo', icono: 'M7 21h10V10H7zM9 10V6h6v4M12 3v3', color: '#4f8a5b' },
  { valor: Categoria.Materiales, etiqueta: 'Materiales de construcción', icono: 'M3 21h18M5 21V11h6v10M13 21V5h6v16', color: '#6e6259' },
  { valor: Categoria.Transporte, etiqueta: 'Transporte', icono: 'M3 16V8h11v8M14 11h4l3 3v2h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', color: '#3d4e6b' },
  { valor: Categoria.Mascotas, etiqueta: 'Mascotas', icono: 'M12 20c-3 0-5-2-5-4s2-4 5-4 5 2 5 4-2 4-5 4zM6 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', color: '#a07a2c' },
  { valor: Categoria.Otra, etiqueta: 'Otra', icono: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', color: '#7d7468' },
];

const CATEGORIA_POR_VALOR = new Map(CATEGORIAS.map((c) => [c.valor, c]));

export function infoCategoria(valor: Categoria): CategoriaInfo {
  return CATEGORIA_POR_VALOR.get(valor) ?? CATEGORIAS[CATEGORIAS.length - 1]!;
}

export interface EstadoInfo {
  readonly etiqueta: string;
  readonly descripcion: string;
  readonly tono: 'pendiente' | 'progreso' | 'entregada' | 'exito' | 'neutro';
}

export const ESTADOS: Record<EstadoNecesidad, EstadoInfo> = {
  [EstadoNecesidad.Registrada]: { etiqueta: 'Esperando ayuda', descripcion: 'Nadie la ha tomado todavía', tono: 'pendiente' },
  [EstadoNecesidad.EnAtencion]: { etiqueta: 'En atención', descripcion: 'Alguien va en camino', tono: 'progreso' },
  [EstadoNecesidad.Entregada]: { etiqueta: 'Entregada', descripcion: 'Falta la confirmación de quien la recibió', tono: 'entregada' },
  [EstadoNecesidad.Atendida]: { etiqueta: 'Atendida', descripcion: 'La ayuda llegó', tono: 'exito' },
  [EstadoNecesidad.Cancelada]: { etiqueta: 'Cancelada', descripcion: 'Ya no se necesita', tono: 'neutro' },
};

export const URGENCIAS: Record<Urgencia, string> = {
  [Urgencia.Alta]: 'Urgente',
  [Urgencia.Media]: 'Pronto',
  [Urgencia.Baja]: 'Puede esperar',
};

export const EVENTOS: Record<TipoEvento, string> = {
  [TipoEvento.Registrada]: 'Necesidad registrada',
  [TipoEvento.Tomada]: 'Alguien la tomó para atenderla',
  [TipoEvento.Liberada]: 'Quien la tomó la liberó',
  [TipoEvento.LiberadaPorVencimiento]: 'Volvió a la lista: pasaron 48 horas sin entrega',
  [TipoEvento.Entregada]: 'Ayuda entregada',
  [TipoEvento.NoRecibida]: 'Quien la pidió reportó que no la recibió',
  [TipoEvento.Confirmada]: 'Quien la recibió confirmó la entrega',
  [TipoEvento.CerradaAutomaticamente]: 'Cerrada como atendida: pasaron 48 horas sin reclamo',
  [TipoEvento.Cancelada]: 'Cancelada por quien la pidió',
};

/** Centro de Sevilla, Valle del Cauca. */
export const CENTRO_SEVILLA = { lat: 4.2667, lng: -75.9333 } as const;

import { FiltroNecesidades, Necesidad } from '../domain/necesidad.model';

function coincideTexto(necesidad: Necesidad, texto: string): boolean {
  const buscado = texto.trim().toLowerCase();
  if (!buscado) return true;
  return [necesidad.titulo, necesidad.descripcion, necesidad.sector].some((campo) =>
    campo.toLowerCase().includes(buscado),
  );
}

/**
 * Filtra y ordena por fecha de solicitud: primero lo mas antiguo (decision de
 * la coordinacion, 2026-10-16). Prioridad 0 y urgencia se ven como etiquetas.
 */
export function filtrarNecesidades(todas: readonly Necesidad[], filtro: FiltroNecesidades): readonly Necesidad[] {
  return todas
    .filter((n) => !filtro.estados?.length || filtro.estados.includes(n.estado))
    .filter((n) => !filtro.categoria || n.categoria === filtro.categoria)
    .filter((n) => !filtro.urgencia || n.urgencia === filtro.urgencia)
    .filter((n) => coincideTexto(n, filtro.texto ?? ''))
    .sort((a, b) => new Date(a.registradaEn).getTime() - new Date(b.registradaEn).getTime());
}

import { FiltroNecesidades, Necesidad, Urgencia } from '../domain/necesidad.model';

const PESO_URGENCIA: Record<Urgencia, number> = {
  [Urgencia.Alta]: 0,
  [Urgencia.Media]: 1,
  [Urgencia.Baja]: 2,
};

function coincideTexto(necesidad: Necesidad, texto: string): boolean {
  const buscado = texto.trim().toLowerCase();
  if (!buscado) return true;
  return [necesidad.titulo, necesidad.descripcion, necesidad.sector].some((campo) =>
    campo.toLowerCase().includes(buscado),
  );
}

/**
 * Filtra y ordena: primero prioridad 0 (bebes o adultos mayores), luego lo mas
 * urgente y, a igual urgencia, lo que lleva mas tiempo esperando.
 */
export function filtrarNecesidades(todas: readonly Necesidad[], filtro: FiltroNecesidades): readonly Necesidad[] {
  return todas
    .filter((n) => !filtro.estados?.length || filtro.estados.includes(n.estado))
    .filter((n) => !filtro.categoria || n.categoria === filtro.categoria)
    .filter((n) => !filtro.urgencia || n.urgencia === filtro.urgencia)
    .filter((n) => coincideTexto(n, filtro.texto ?? ''))
    .sort(
      (a, b) =>
        Number(b.prioridadCero) - Number(a.prioridadCero) ||
        PESO_URGENCIA[a.urgencia] - PESO_URGENCIA[b.urgencia] ||
        new Date(a.registradaEn).getTime() - new Date(b.registradaEn).getTime(),
    );
}

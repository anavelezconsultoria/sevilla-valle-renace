import { CifrasPublicas, EstadoNecesidad, Necesidad } from '../domain/necesidad.model';

/**
 * Cifras publicas a partir de la lista de necesidades. Igual para cualquier backend.
 * `personasExtra`: ayudas que la coordinacion entrego por fuera de la plataforma.
 */
export function calcularCifras(necesidades: readonly Necesidad[], personasExtra = 0): CifrasPublicas {
  const contar = (estado: EstadoNecesidad) => necesidades.filter((n) => n.estado === estado).length;
  return {
    registradas: contar(EstadoNecesidad.Registrada),
    enAtencion: contar(EstadoNecesidad.EnAtencion),
    entregadas: contar(EstadoNecesidad.Entregada),
    atendidas: contar(EstadoNecesidad.Atendida),
    personasAyudadas: necesidades
      .filter((n) => n.estado === EstadoNecesidad.Atendida)
      .reduce((total, n) => total + n.personasHogar, personasExtra),
  };
}

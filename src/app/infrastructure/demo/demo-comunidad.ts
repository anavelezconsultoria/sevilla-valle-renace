import { inject, Injectable } from '@angular/core';
import { EstadoNecesidad, TipoEvento } from '../../core/domain/necesidad.model';
import { ComunidadGateway, PaginaMuro, PublicacionMuro } from '../../core/ports/necesidades.ports';
import { DemoBackend } from './demo-backend';

/** Muro de la comunidad en el modo demostracion: se arma con los datos de ejemplo. */
@Injectable({ providedIn: 'root' })
export class DemoComunidad implements ComunidadGateway {
  private readonly backend = inject(DemoBackend);
  private readonly gracias = new Map<string, number>();

  async muro({ antes, limite }: PaginaMuro): Promise<readonly PublicacionMuro[]> {
    return this.publicaciones()
      .filter((p) => !antes || p.ocurridoEn < antes)
      .slice(0, limite);
  }

  async darGracias(eventoId: string): Promise<number> {
    const total = (this.gracias.get(eventoId) ?? 0) + 1;
    this.gracias.set(eventoId, total);
    return total;
  }

  private publicaciones(): PublicacionMuro[] {
    return this.backend
      .todas()
      .filter((n) => n.estado === EstadoNecesidad.Entregada || n.estado === EstadoNecesidad.Atendida)
      .flatMap((n) =>
        n.eventos
          .filter((e) => e.tipo === TipoEvento.Entregada || e.tipo === TipoEvento.Confirmada)
          .map((e) => ({
            eventoId: e.id,
            tipo: e.tipo === TipoEvento.Entregada ? ('entrega' as const) : ('confirmacion' as const),
            ocurridoEn: e.ocurridoEn,
            ayudante: e.tipo === TipoEvento.Entregada ? e.actor : n.ayudanteAlias,
            categoria: n.categoria,
            sector: n.sector,
            personasHogar: n.personasHogar,
            foto: e.evidencias[0]?.url,
            gracias: this.gracias.get(e.id) ?? 0,
          })),
      )
      .sort((a, b) => b.ocurridoEn.localeCompare(a.ocurridoEn));
  }
}

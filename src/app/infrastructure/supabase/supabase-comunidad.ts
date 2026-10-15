import { inject, Injectable } from '@angular/core';
import { Categoria } from '../../core/domain/necesidad.model';
import { ComunidadGateway, PaginaMuro, PublicacionMuro } from '../../core/ports/necesidades.ports';
import { idDispositivo } from '../../shared/lib/dispositivo';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';
import { SUPABASE_CONFIG } from './supabase.config';

interface FilaPublicacion {
  readonly evento_id: string;
  readonly tipo: 'entregada' | 'confirmada';
  readonly ocurrido_en: string;
  readonly ayudante: string | null;
  readonly categoria: Categoria;
  readonly sector: string;
  readonly personas_hogar: number;
  readonly foto: string | null;
  readonly gracias: number;
}

/** Adaptador de Supabase para el muro de la comunidad (funciones muro_comunidad y dar_gracias). */
@Injectable({ providedIn: 'root' })
export class SupabaseComunidad implements ComunidadGateway {
  private readonly cliente = inject(SUPABASE_CLIENTE);
  private readonly config = inject(SUPABASE_CONFIG);

  async muro({ antes, limite }: PaginaMuro): Promise<readonly PublicacionMuro[]> {
    const filas = exigir<readonly FilaPublicacion[]>(
      await this.cliente.rpc('muro_comunidad', { p_limite: limite, p_antes: antes ?? null }),
    );
    return filas.map((f) => this.aPublicacion(f));
  }

  async darGracias(eventoId: string): Promise<number> {
    return Number(exigir<number>(await this.cliente.rpc('dar_gracias', { p_evento: eventoId, p_dispositivo: idDispositivo() })));
  }

  private aPublicacion(f: FilaPublicacion): PublicacionMuro {
    return {
      eventoId: f.evento_id,
      tipo: f.tipo === 'entregada' ? 'entrega' : 'confirmacion',
      ocurridoEn: f.ocurrido_en,
      ayudante: f.ayudante ?? undefined,
      categoria: f.categoria,
      sector: f.sector,
      personasHogar: f.personas_hogar,
      foto: f.foto ? this.cliente.storage.from(this.config.bucketEvidencias).getPublicUrl(f.foto).data.publicUrl : undefined,
      gracias: Number(f.gracias),
    };
  }
}

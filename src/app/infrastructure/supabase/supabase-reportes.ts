import { inject, Injectable } from '@angular/core';
import { ReportarMalUsoPayload, ReportesGateway } from '../../core/ports/necesidades.ports';
import { idDispositivo } from '../../shared/lib/dispositivo';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';

/** Adaptador de Supabase para los reportes de mal uso (funcion reportar_mal_uso, migracion 0028). */
@Injectable({ providedIn: 'root' })
export class SupabaseReportes implements ReportesGateway {
  private readonly cliente = inject(SUPABASE_CLIENTE);

  async reportar({ necesidadId, motivo, nota }: ReportarMalUsoPayload): Promise<void> {
    exigir<null>(
      await this.cliente.rpc('reportar_mal_uso', { p_necesidad: necesidadId, p_motivo: motivo, p_nota: nota, p_dispositivo: idDispositivo() }),
    );
  }
}

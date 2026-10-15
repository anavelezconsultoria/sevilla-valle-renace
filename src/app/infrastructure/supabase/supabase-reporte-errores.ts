import { inject, Injectable } from '@angular/core';
import { ErrorCliente, ReporteErrores } from '../../core/ports/necesidades.ports';
import { SUPABASE_CLIENTE } from './supabase-cliente';

/** Anota los errores de la pagina en la base (funcion registrar_error_cliente). */
@Injectable({ providedIn: 'root' })
export class SupabaseReporteErrores implements ReporteErrores {
  private readonly cliente = inject(SUPABASE_CLIENTE);

  async reportar({ mensaje, pila, ruta, navegador, version }: ErrorCliente): Promise<void> {
    await this.cliente.rpc('registrar_error_cliente', {
      p_mensaje: mensaje,
      p_pila: pila ?? null,
      p_ruta: ruta,
      p_navegador: navegador,
      p_version: version,
    });
  }
}

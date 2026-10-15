import { Injectable } from '@angular/core';
import { ErrorCliente, ReporteErrores } from '../../core/ports/necesidades.ports';

/** En el modo demostracion los errores solo se avisan en la consola. */
@Injectable({ providedIn: 'root' })
export class ConsolaReporteErrores implements ReporteErrores {
  async reportar(error: ErrorCliente): Promise<void> {
    console.warn('[demo] error que se reportaria:', error.mensaje, error.ruta);
  }
}

import { ErrorHandler, inject, Injectable } from '@angular/core';
import { ErrorCliente, ReporteErrores } from '../../core/ports/necesidades.ports';

/** Cuantos errores distintos se reportan como maximo por visita (evita inundar la base). */
const MAX_REPORTES_POR_VISITA = 10;
const LARGO_PILA = 2000;
const LARGO_NAVEGADOR = 300;

/**
 * Manejador global de errores: los que nadie atrapo (un boton que falla, una
 * funcion que el navegador no conoce) se muestran en consola y se anotan en la
 * base para que la coordinacion se entere sin esperar un WhatsApp.
 * Cada error distinto se reporta una sola vez por visita.
 */
@Injectable()
export class ManejadorErrores implements ErrorHandler {
  private readonly reporte = inject(ReporteErrores);
  private readonly yaReportados = new Set<string>();

  handleError(error: unknown): void {
    console.error(error);
    const datos = this.describir(error);
    const firma = `${datos.mensaje}|${datos.ruta}`;
    if (this.yaReportados.has(firma) || this.yaReportados.size >= MAX_REPORTES_POR_VISITA) return;
    this.yaReportados.add(firma);
    // Nunca debe romper nada: si reportar falla, se ignora.
    void this.reporte.reportar(datos).catch(() => undefined);
  }

  private describir(error: unknown): ErrorCliente {
    const base = error instanceof Error ? error : new Error(String(error));
    return {
      mensaje: base.message || base.name || 'Error sin mensaje',
      pila: base.stack?.slice(0, LARGO_PILA),
      ruta: typeof location === 'undefined' ? '' : location.pathname,
      navegador: typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, LARGO_NAVEGADOR),
      version: versionPublicada(),
    };
  }
}

/** Version publicada: el nombre con hash del script principal (cambia en cada publicacion). */
function versionPublicada(): string {
  if (typeof document === 'undefined') return '';
  const script = document.querySelector<HTMLScriptElement>('script[src*="main"]');
  return script?.src.split('/').pop() ?? '';
}

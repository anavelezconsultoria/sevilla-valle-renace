import { Injectable, signal } from '@angular/core';

/**
 * Recuerda en ESTE celular las necesidades que registro, con su llave interna,
 * para que quien pidio la ayuda la confirme con un toque, sin escribir nada.
 * Solo vive en el navegador de la persona; el servidor nunca recibe esta lista.
 */

export interface SolicitudLocal {
  readonly necesidadId: string;
  /** Llave interna del registro: nunca se muestra a la persona. */
  readonly codigo: string;
  readonly titulo: string;
  readonly registradaEn: string;
}

const CLAVE = 'sevilla-renace-mis-solicitudes';
const MAXIMO = 20;

@Injectable({ providedIn: 'root' })
export class SolicitudesLocales {
  private readonly lista = signal<readonly SolicitudLocal[]>(this.leer());
  readonly todas = this.lista.asReadonly();

  guardar(solicitud: SolicitudLocal): void {
    const sinRepetir = this.lista().filter((s) => s.necesidadId !== solicitud.necesidadId);
    this.escribir([solicitud, ...sinRepetir].slice(0, MAXIMO));
  }

  codigoDe(necesidadId: string): string | null {
    return this.lista().find((s) => s.necesidadId === necesidadId)?.codigo ?? null;
  }

  private escribir(lista: readonly SolicitudLocal[]): void {
    this.lista.set(lista);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      /* Sin almacenamiento: se recuerda solo mientras la pestaña este abierta. */
    }
  }

  private leer(): readonly SolicitudLocal[] {
    try {
      const crudo = localStorage.getItem(CLAVE);
      return crudo ? (JSON.parse(crudo) as SolicitudLocal[]) : [];
    } catch {
      return [];
    }
  }
}

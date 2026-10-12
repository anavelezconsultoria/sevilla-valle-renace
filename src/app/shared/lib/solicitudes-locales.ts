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

/**
 * Datos de quien pide ayuda en ESTE celular: la segunda solicitud no vuelve a
 * pedir nombre, celular ni clave. La clave queda solo en este navegador.
 */
export interface PerfilSolicitante {
  readonly nombre: string;
  readonly telefono: string;
  readonly clave: string;
}

const CLAVE = 'sevilla-renace-mis-solicitudes';
const CLAVE_PERFIL = 'sevilla-renace-solicitante';
const MAXIMO = 20;

@Injectable({ providedIn: 'root' })
export class SolicitudesLocales {
  private readonly lista = signal<readonly SolicitudLocal[]>(this.leer());
  readonly todas = this.lista.asReadonly();
  private readonly perfilGuardado = signal<PerfilSolicitante | null>(this.leerPerfil());
  readonly perfil = this.perfilGuardado.asReadonly();

  guardarPerfil(perfil: PerfilSolicitante): void {
    this.perfilGuardado.set(perfil);
    try {
      localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
    } catch {
      /* Sin almacenamiento: se recuerda solo mientras la pestaña este abierta. */
    }
  }

  private leerPerfil(): PerfilSolicitante | null {
    try {
      const crudo = localStorage.getItem(CLAVE_PERFIL);
      return crudo ? (JSON.parse(crudo) as PerfilSolicitante) : null;
    } catch {
      return null;
    }
  }

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

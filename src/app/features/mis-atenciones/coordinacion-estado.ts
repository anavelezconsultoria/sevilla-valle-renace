import { inject, Injectable, signal } from '@angular/core';
import { AtencionEnCurso, CoordinacionGateway, RevisarPayload, SolicitudEnRevision } from '../../core/ports/necesidades.ports';

function mensajeDe(error: unknown, porDefecto: string): string {
  return error instanceof Error ? error.message : porDefecto;
}

/**
 * Estado compartido de las herramientas de coordinacion dentro de Mi panel:
 * las pestanas muestran los contadores y las pantallas leen las mismas listas,
 * sin pedir los datos dos veces. Se provee en la pagina, no en la raiz.
 */
@Injectable()
export class CoordinacionEstado {
  private readonly coordinacion = inject(CoordinacionGateway);

  readonly enRevision = signal<readonly SolicitudEnRevision[]>([]);
  readonly enCurso = signal<readonly AtencionEnCurso[]>([]);
  readonly cargando = signal(false);
  readonly errorRevision = signal<string | null>(null);
  readonly errorEnCurso = signal<string | null>(null);

  async cargar(): Promise<void> {
    this.cargando.set(true);
    await Promise.all([this.cargarRevision(), this.cargarEnCurso()]);
    this.cargando.set(false);
  }

  async revisar(payload: RevisarPayload): Promise<void> {
    await this.coordinacion.revisar(payload);
    this.enRevision.update((lista) => lista.filter((s) => s.necesidadId !== payload.necesidadId));
  }

  private async cargarRevision(): Promise<void> {
    try {
      this.enRevision.set(await this.coordinacion.solicitudesEnRevision());
      this.errorRevision.set(null);
    } catch (e) {
      this.errorRevision.set(mensajeDe(e, 'No se pudieron cargar las solicitudes en revisión.'));
    }
  }

  private async cargarEnCurso(): Promise<void> {
    try {
      this.enCurso.set(await this.coordinacion.atencionesEnCurso());
      this.errorEnCurso.set(null);
    } catch (e) {
      this.errorEnCurso.set(mensajeDe(e, 'No se pudieron cargar las ayudas en curso.'));
    }
  }
}

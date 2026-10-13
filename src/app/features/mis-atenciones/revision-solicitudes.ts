import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CoordinacionGateway, SolicitudEnRevision } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { tiempoRelativo } from '../../shared/lib/tiempo';

/**
 * Herramienta de la coordinacion: solicitudes de hogares que recibieron ayuda
 * hace poco. No se publican hasta que alguien las revisa. Regla: antes de
 * rechazar, llamar a la familia; una emergencia puede cambiar de un dia a otro.
 */
@Component({
  selector: 'sr-revision-solicitudes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Solicitudes en revisión</h2>
      <p class="muted">Hogares que pidieron otra vez poco después de recibir ayuda. No se publican hasta que las revises. <strong>Si dudas, llama antes de decidir.</strong></p>

      @if (cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!solicitudes().length) {
        <p class="vacio">No hay solicitudes esperando revisión.</p>
      } @else {
        <ul class="lista">
          @for (s of solicitudes(); track s.necesidadId) {
            <li class="item">
              <div class="encabezado">
                <strong>{{ s.titulo }}</strong>
                <span class="muted">{{ etiquetaCategoria(s) }} · {{ s.sector }} · {{ hace(s) }}</span>
              </div>
              <p class="motivo">{{ s.motivo }}</p>
              <p class="contacto">{{ s.nombre }} · <a [href]="'tel:+57' + s.telefono">{{ s.telefono }}</a></p>
              <div class="acciones">
                <button type="button" class="btn btn-primary" [disabled]="ocupado() === s.necesidadId" (click)="revisar(s, true)">Publicar</button>
                <button type="button" class="btn btn-ghost" [disabled]="ocupado() === s.necesidadId" (click)="revisar(s, false)">No publicar</button>
              </div>
            </li>
          }
        </ul>
      }
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); margin-top: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; }
    .item { display: grid; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--color-linea); border-radius: var(--radius-sm); }
    .encabezado { display: grid; gap: 2px; }
    .encabezado .muted { font-size: var(--text-xs); }
    .motivo { font-size: var(--text-sm); font-weight: 600; color: var(--color-texto); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-acento-suave); }
    .contacto { font-size: var(--text-sm); }
    .acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .vacio { font-size: var(--text-sm); color: var(--color-tenue); }
  `,
})
export class RevisionSolicitudes {
  private readonly coordinacion = inject(CoordinacionGateway);

  protected readonly solicitudes = signal<readonly SolicitudEnRevision[]>([]);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    void this.cargar();
  }

  protected etiquetaCategoria(s: SolicitudEnRevision): string {
    return infoCategoria(s.categoria).etiqueta;
  }

  protected hace(s: SolicitudEnRevision): string {
    return tiempoRelativo(s.registradaEn);
  }

  protected async revisar(s: SolicitudEnRevision, aprobar: boolean): Promise<void> {
    const pregunta = aprobar
      ? `¿Publicar «${s.titulo}»? Quedará visible para que alguien la tome.`
      : `¿No publicar «${s.titulo}»? Se cancelará. Mejor si ya hablaste con ${s.nombre}.`;
    if (!confirm(pregunta)) return;
    this.ocupado.set(s.necesidadId);
    this.error.set(null);
    try {
      await this.coordinacion.revisar({ necesidadId: s.necesidadId, aprobar });
      this.solicitudes.update((lista) => lista.filter((x) => x.necesidadId !== s.necesidadId));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la revisión.');
    } finally {
      this.ocupado.set(null);
    }
  }

  private async cargar(): Promise<void> {
    try {
      this.solicitudes.set(await this.coordinacion.solicitudesEnRevision());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes en revisión.');
    } finally {
      this.cargando.set(false);
    }
  }
}

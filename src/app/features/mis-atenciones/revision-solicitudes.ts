import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SolicitudEnRevision } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { CoordinacionEstado } from './coordinacion-estado';

/**
 * Herramienta de la coordinacion: solicitudes de hogares que recibieron ayuda
 * hace poco. No se publican hasta que alguien las revisa. Regla: antes de
 * rechazar, llamar a la familia; una emergencia puede cambiar de un dia a otro.
 */
@Component({
  selector: 'sr-revision-solicitudes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="herramienta">
      <p class="muted">Hogares que pidieron otra vez poco después de recibir ayuda. No se publican hasta que las revises. <strong>Si dudas, llama antes de decidir.</strong></p>

      @if (estado.cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!estado.enRevision().length) {
        <div class="vacio">
          <span class="icono" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <p>Todo al día: no hay solicitudes esperando revisión.</p>
        </div>
      } @else {
        <ul class="lista">
          @for (s of estado.enRevision(); track s.necesidadId) {
            <li class="card item entrada">
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
      @if (estado.errorRevision() ?? error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-4); }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .item { display: grid; gap: var(--space-2); padding: var(--space-4); }
    .encabezado { display: grid; gap: 2px; }
    .encabezado .muted { font-size: var(--text-xs); }
    .motivo { font-size: var(--text-sm); font-weight: 600; color: var(--color-texto); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-acento-suave); }
    .contacto { font-size: var(--text-sm); }
    .acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .vacio { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-5); border-radius: var(--radius-lg); background: var(--color-montana-suave); color: var(--color-montana); font-weight: 600; }
    .icono { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--color-superficie); font-size: 20px; }
  `,
})
export class RevisionSolicitudes {
  protected readonly estado = inject(CoordinacionEstado);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

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
      await this.estado.revisar({ necesidadId: s.necesidadId, aprobar });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la revisión.');
    } finally {
      this.ocupado.set(null);
    }
  }
}

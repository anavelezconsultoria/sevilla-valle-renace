import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoordinacionGateway, NecesidadesLectura, SolicitudDelHistorial } from '../../core/ports/necesidades.ports';
import { Necesidad } from '../../core/domain/necesidad.model';
import { ESTADOS, URGENCIAS } from '../../core/domain/catalogos';
import { SolicitudEnRevision } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { fechaCorta, tiempoRelativo } from '../../shared/lib/tiempo';
import { CoordinacionEstado } from './coordinacion-estado';

/**
 * Herramienta de la coordinacion: solicitudes de hogares que recibieron ayuda
 * hace poco. No se publican hasta que alguien las revisa. Regla: antes de
 * rechazar, llamar a la familia; una emergencia puede cambiar de un dia a otro.
 */
@Component({
  selector: 'sr-revision-solicitudes',
  imports: [RouterLink],
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
              @if (detalle(s); as n) {
                <details class="detalle" [open]="abierta() === s.necesidadId" (toggle)="alAlternar(s.necesidadId, $event)">
                  <summary>Ver detalles de la solicitud</summary>
                  <p class="descripcion">{{ n.descripcion }}</p>
                  <ul class="datos">
                    <li>{{ n.personasHogar }} {{ n.personasHogar === 1 ? 'persona' : 'personas' }}</li>
                    <li>{{ urgencia(n) }}</li>
                    @if (n.prioridadCero) {
                      <li class="prioridad">Prioridad 0 · bebés o adultos mayores</li>
                    }
                  </ul>
                  @if (n.fotos.length) {
                    <div class="fotos">
                      @for (f of n.fotos; track f) {
                        <a [href]="f" target="_blank" rel="noopener"><img [src]="f" alt="Foto de la solicitud" loading="lazy" /></a>
                      }
                    </div>
                  }
                  <a class="abrir" [routerLink]="['/necesidades', n.id]">Abrir la solicitud completa →</a>
                </details>
              }
              <details class="detalle" (toggle)="alAbrirHogar(s, $event)">
                <summary>Ver lo que ha pedido este hogar</summary>
                @if (otras()[s.necesidadId]; as lista) {
                  @if (!lista.length) {
                    <p class="muted">No tiene otras solicitudes con este celular.</p>
                  }
                  <ul class="otras">
                    @for (o of lista; track o.id) {
                      <li>
                        <strong>{{ o.titulo }}</strong>
                        <span class="muted">{{ etiquetaCategoria(o) }} · {{ etiquetaEstado(o) }} · pidió {{ fecha(o.registradaEn) }}</span>
                        @if (o.entregadaEn) {
                          <span class="muted">Le llegó {{ fecha(o.entregadaEn) }}{{ o.ayudante ? ' · la llevó ' + o.ayudante : '' }}</span>
                        }
                        @if (detallePorId(o.id); as d) {
                          <span class="descripcion">{{ d.descripcion }}</span>
                          <span class="muted">{{ d.personasHogar }} {{ d.personasHogar === 1 ? 'persona' : 'personas' }}</span>
                        }
                        <a class="abrir" [routerLink]="['/necesidades', o.id]">Abrir →</a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="muted">Cargando...</p>
                }
              </details>
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
    .detalle { border-radius: var(--radius-sm); border: 1px solid var(--color-linea); }
    .detalle summary { padding: var(--space-2) var(--space-3); font-size: var(--text-sm); font-weight: 650; color: var(--color-primario); cursor: pointer; list-style-position: inside; }
    .detalle[open] summary { border-bottom: 1px solid var(--color-linea); }
    .detalle > :not(summary) { margin: var(--space-3); }
    .descripcion { font-size: var(--text-sm); color: var(--color-texto); white-space: pre-line; }
    .datos { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; list-style: none; }
    .datos li { padding: 3px 10px; border-radius: var(--radius-pill); background: var(--color-arena); font-size: var(--text-xs); font-weight: 600; }
    .datos .prioridad { background: linear-gradient(135deg, #2b4cf2, #6a4fe0); color: #fff; }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .fotos img { width: 84px; height: 84px; object-fit: cover; border-radius: var(--radius-sm); }
    .otras { display: grid; gap: var(--space-3); list-style: none; padding: 0; }
    .otras li { display: grid; gap: 2px; padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-linea); font-size: var(--text-sm); }
    .otras li:last-child { border-bottom: 0; padding-bottom: 0; }
    .otras .muted { font-size: var(--text-xs); }
    .abrir { display: inline-block; font-size: var(--text-sm); font-weight: 650; color: var(--color-primario); }
    .acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .vacio { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-5); border-radius: var(--radius-lg); background: var(--color-montana-suave); color: var(--color-montana); font-weight: 600; }
    .icono { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--color-superficie); font-size: 20px; }
  `,
})
export class RevisionSolicitudes {
  protected readonly estado = inject(CoordinacionEstado);
  private readonly lectura = inject(NecesidadesLectura);
  private readonly coordinacion = inject(CoordinacionGateway);
  protected readonly fecha = fechaCorta;
  /** Otras solicitudes del mismo celular, por solicitud en revision. Se piden al abrir. */
  protected readonly otras = signal<Readonly<Record<string, readonly SolicitudDelHistorial[]>>>({});
  /** Solicitud con los detalles abiertos (una a la vez). */
  protected readonly abierta = signal<string | null>(null);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected etiquetaCategoria(s: Pick<SolicitudEnRevision, 'categoria'>): string {
    return infoCategoria(s.categoria).etiqueta;
  }

  /** Detalles publicos de la solicitud (descripcion, personas, fotos). */
  protected detalle(s: SolicitudEnRevision): Necesidad | undefined {
    return this.lectura.obtener(s.necesidadId);
  }

  protected detallePorId(id: string): Necesidad | undefined {
    return this.lectura.obtener(id);
  }

  protected etiquetaEstado(o: SolicitudDelHistorial): string {
    return ESTADOS[o.estado].etiqueta;
  }

  protected async alAbrirHogar(s: SolicitudEnRevision, evento: Event): Promise<void> {
    if (!(evento.target as HTMLDetailsElement).open || this.otras()[s.necesidadId]) return;
    try {
      const historial = await this.coordinacion.historial(s.telefono);
      const lista = historial.solicitudes.filter((o) => o.id !== s.necesidadId);
      this.otras.update((actual) => ({ ...actual, [s.necesidadId]: lista }));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar lo que ha pedido este hogar.');
    }
  }

  protected urgencia(n: Necesidad): string {
    return URGENCIAS[n.urgencia];
  }

  protected alAlternar(id: string, evento: Event): void {
    const abierto = (evento.target as HTMLDetailsElement).open;
    if (abierto) this.abierta.set(id);
    else if (this.abierta() === id) this.abierta.set(null);
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

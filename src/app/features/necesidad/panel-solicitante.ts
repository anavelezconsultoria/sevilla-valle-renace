import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SolicitanteGateway } from '../../core/ports/necesidades.ports';
import { EstadoNecesidad, Necesidad } from '../../core/domain/necesidad.model';
import { SolicitudesLocales } from '../../shared/lib/solicitudes-locales';
import { Celebracion } from '../../shared/ui/celebracion';

/**
 * Panel para quien pidio la ayuda. Si este celular registro la necesidad,
 * confirma con un toque (el codigo ya esta guardado). Si no, lo lleva a
 * confirmar con su codigo.
 */
@Component({
  selector: 'sr-panel-solicitante',
  imports: [RouterLink, Celebracion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let n = necesidad();
    @if (celebrar()) {
      <sr-celebracion />
    }
    @if (codigo(); as c) {
      <section class="card panel propia">
        <p class="etiqueta">Tú registraste esta necesidad desde este celular</p>
        @if (n.estado === 'entregada') {
          <h2>¿Te llegó la ayuda?</h2>
          <p class="muted"><strong>{{ n.ayudanteAlias }}</strong> registró la entrega. Confírmalo para cerrar tu solicitud.</p>
          <div class="botones">
            <button type="button" class="btn btn-success" [disabled]="ocupado()" (click)="confirmar(c)">Sí, la recibí</button>
            <a class="btn btn-secondary" [routerLink]="['/seguimiento']" [queryParams]="{ codigo: c }">No la he recibido</a>
          </div>
        } @else if (n.estado === 'atendida') {
          <h2>¡Qué bueno que llegó!</h2>
          <p class="muted">Tu solicitud quedó cerrada como atendida.</p>
        } @else {
          <p class="muted">{{ mensajeEstado() }}</p>
          <a class="enlace" [routerLink]="['/seguimiento']" [queryParams]="{ codigo: c }">Ver mi solicitud y mi código</a>
        }
        @if (error(); as e) {
          <p class="field-error" role="alert">{{ e }}</p>
        }
      </section>
    } @else if (n.estado === 'entregada') {
      <section class="card panel">
        <h2>¿Tú pediste esta ayuda?</h2>
        <p class="muted">Confirma que te llegó con el código que recibiste al registrarla.</p>
        <a class="btn btn-accion btn-block" routerLink="/seguimiento">Confirmar con mi código</a>
      </section>
    }
  `,
  styles: `
    .panel { display: grid; gap: var(--space-3); padding: var(--space-5); animation: aparecer var(--dur-media) var(--ease-salida); }
    .propia { border-color: var(--color-acento); background: linear-gradient(var(--color-acento-suave), var(--color-superficie) 60%); }
    .etiqueta { font-size: var(--text-xs); font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: var(--color-acento); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .botones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .enlace { font-size: var(--text-sm); font-weight: 600; color: var(--color-accion); }
  `,
})
export class PanelSolicitante {
  private readonly solicitante = inject(SolicitanteGateway);
  private readonly locales = inject(SolicitudesLocales);

  readonly necesidad = input.required<Necesidad>();

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly celebrar = signal(false);
  protected readonly codigo = computed(() => this.locales.codigoDe(this.necesidad().id));
  protected readonly mensajeEstado = computed(() => {
    const estado = this.necesidad().estado;
    if (estado === EstadoNecesidad.Registrada) return 'Está en el mapa esperando que alguien la tome.';
    if (estado === EstadoNecesidad.EnAtencion) return `${this.necesidad().ayudanteAlias ?? 'Alguien'} la tomó y va a contactarte.`;
    return 'Ya no está activa.';
  });

  protected async confirmar(codigo: string): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await this.solicitante.confirmarRecibida(codigo);
      this.celebrar.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo confirmar. Inténtalo de nuevo.');
    } finally {
      this.ocupado.set(false);
    }
  }
}

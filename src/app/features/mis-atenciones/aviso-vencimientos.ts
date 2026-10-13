import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoNecesidad, Necesidad } from '../../core/domain/necesidad.model';
import { HORAS_AVISO_VENCIMIENTO, horasRestantes } from '../../core/domain/ciclo-de-vida';

interface PorVencer {
  readonly necesidad: Necesidad;
  readonly horas: number;
}

/**
 * Aviso de Mi panel: lo que esta por vencer. Evita que una entrega en camino se
 * libere sola sin que quien ayuda se de cuenta.
 */
@Component({
  selector: 'sr-aviso-vencimientos',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (porVencer().length) {
      <section class="aviso" role="status">
        <h2>Por vencer</h2>
        <ul>
          @for (p of porVencer(); track p.necesidad.id) {
            <li>
              <a [routerLink]="['/necesidades', p.necesidad.id]">
                <span><strong>{{ p.necesidad.titulo }}</strong> · {{ p.necesidad.sector }}</span>
                <span class="horas">{{ p.horas < 1 ? 'Menos de 1 hora' : 'Quedan ' + p.horas + (p.horas === 1 ? ' hora' : ' horas') }}</span>
              </a>
            </li>
          }
        </ul>
        <p class="muted">Entrégala y regístrala, o entra y toca "Necesito 24 horas más". Si se vence, vuelve a la lista para que otra persona la tome.</p>
      </section>
    }
  `,
  styles: `
    .aviso { display: grid; gap: var(--space-2); padding: var(--space-4); margin-bottom: var(--space-4); border-radius: var(--radius-lg); border: 1.5px solid #f2c770; background: var(--estado-progreso-bg); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); color: var(--estado-progreso); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    a { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-superficie); text-decoration: none; color: inherit; font-size: var(--text-sm); }
    .horas { font-weight: 700; color: var(--estado-progreso); }
    .muted { font-size: var(--text-xs); }
  `,
})
export class AvisoVencimientos {
  readonly necesidades = input.required<readonly Necesidad[]>();

  protected readonly porVencer = computed<readonly PorVencer[]>(() =>
    this.necesidades()
      .filter((n) => n.estado === EstadoNecesidad.EnAtencion)
      .map((n) => ({ necesidad: n, horas: horasRestantes(n.venceEn) ?? Infinity }))
      .filter((p) => p.horas <= HORAS_AVISO_VENCIMIENTO)
      .map((p) => ({ ...p, horas: Math.max(0, Math.floor(p.horas)) }))
      .sort((a, b) => a.horas - b.horas),
  );
}

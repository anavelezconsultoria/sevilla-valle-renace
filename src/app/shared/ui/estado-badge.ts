import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CierreAtencion, EstadoNecesidad } from '../../core/domain/necesidad.model';
import { ESTADOS } from '../../core/domain/catalogos';

@Component({
  selector: 'sr-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-tono]="info().tono" [title]="info().descripcion">{{ etiqueta() }}</span>`,
  styles: `
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }
    .badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    [data-tono='pendiente'] { color: var(--estado-pendiente); background: var(--estado-pendiente-bg); }
    [data-tono='progreso'] { color: var(--estado-progreso); background: var(--estado-progreso-bg); }
    [data-tono='entregada'] { color: var(--estado-entregada); background: var(--estado-entregada-bg); }
    [data-tono='exito'] { color: var(--estado-exito); background: var(--estado-exito-bg); }
    [data-tono='neutro'] { color: var(--estado-neutro); background: var(--estado-neutro-bg); }
  `,
})
export class EstadoBadge {
  readonly estado = input.required<EstadoNecesidad>();
  readonly cierre = input<CierreAtencion>();
  protected readonly info = computed(() => ESTADOS[this.estado()]);
  protected readonly etiqueta = computed(() =>
    this.cierre() === CierreAtencion.Automatica ? 'Atendida (sin reclamo)' : this.info().etiqueta,
  );
}

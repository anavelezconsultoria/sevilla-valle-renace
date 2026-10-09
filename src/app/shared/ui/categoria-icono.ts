import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Categoria } from '../../core/domain/necesidad.model';
import { infoCategoria } from '../../core/domain/catalogos';

@Component({
  selector: 'sr-categoria-icono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--cat]': 'info().color', '[style.--size.px]': 'tamano()' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path [attr.d]="info().icono" />
    </svg>
  `,
  styles: `
    :host { display: inline-grid; place-items: center; flex: none; width: var(--size); height: var(--size); border-radius: 30%; color: var(--cat); background: color-mix(in srgb, var(--cat) 12%, white); }
    svg { width: 58%; height: 58%; }
  `,
})
export class CategoriaIcono {
  readonly categoria = input.required<Categoria>();
  readonly tamano = input(40);
  protected readonly info = computed(() => infoCategoria(this.categoria()));
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface EstadoCampo {
  readonly errores: readonly { readonly message?: string }[];
  readonly visible: boolean;
}

/** Muestra el primer error de un campo, solo cuando ya fue tocado o se intento enviar. */
@Component({
  selector: 'sr-errores-campo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mensaje(); as m) {
      <p class="field-error" role="alert">{{ m }}</p>
    }
  `,
})
export class ErroresCampo {
  readonly estado = input.required<EstadoCampo>();
  protected readonly mensaje = computed(() => {
    const { errores, visible } = this.estado();
    return visible ? (errores[0]?.message ?? null) : null;
  });
}

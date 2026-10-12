import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Compartible, compartirImagen } from '../lib/tarjeta-compartir';

/** Boton que genera una imagen y la comparte. Recibe "que compartir" como una funcion. */
@Component({
  selector: 'sr-boton-compartir',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-whatsapp btn-block compartir" [disabled]="ocupado()" (click)="compartir()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>
      {{ ocupado() ? 'Preparando la imagen...' : texto() }}
    </button>
    @if (error(); as e) {
      <p class="field-error" role="alert">{{ e }}</p>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-2); }
    .compartir { gap: 10px; }
    svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `,
})
export class BotonCompartir {
  readonly texto = input.required<string>();
  /** Arma la imagen y el texto solo cuando se toca (no gasta recursos antes). */
  readonly preparar = input.required<() => Promise<Compartible>>();

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async compartir(): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await compartirImagen(await this.preparar()());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo compartir. Inténtalo de nuevo.');
    } finally {
      this.ocupado.set(false);
    }
  }
}

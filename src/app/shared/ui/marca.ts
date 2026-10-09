import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Marca de Sevilla Renace: un brote que sale de la tierra, en los colores de Ana Vélez. */
@Component({
  selector: 'sr-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="tamano()" [attr.height]="tamano()" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#003cff" />
      <path d="M32 50V30" stroke="#fff6f1" stroke-width="5" stroke-linecap="round" />
      <path d="M32 34c0-9 7-15 16-15 0 9-7 15-16 15z" fill="#d7bafc" />
      <path d="M32 30c0-7-5-12-13-12 0 7 5 12 13 12z" fill="#fff6f1" />
      <path d="M18 50h28" stroke="#d7bafc" stroke-width="4" stroke-linecap="round" />
    </svg>
    @if (conTexto()) {
      <span class="texto">Sevilla<strong>Renace</strong></span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    .texto { font-family: var(--font-display); font-size: 1.05rem; color: var(--color-ink); letter-spacing: -0.02em; }
    strong { font-weight: 400; color: var(--color-blue); }
  `,
})
export class Marca {
  readonly tamano = input(36);
  readonly conTexto = input(true);
}

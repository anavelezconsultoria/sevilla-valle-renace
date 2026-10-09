import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Marca de Sevilla Renace: un brote cafetero que sale de la tierra.
 * Azul y lavanda de Ana Vélez, como su logo.
 */
@Component({
  selector: 'sr-marca',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="simbolo" [attr.width]="tamano()" [attr.height]="tamano()" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#2b4cf2" />
      <path class="tallo" d="M32 49V29" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" />
      <path class="hoja hoja-der" d="M32 33c0-9 7-15 16-15 0 9-7 15-16 15z" fill="#d7bafc" />
      <path class="hoja hoja-izq" d="M32 29c0-7-5-12-13-12 0 7 5 12 13 12z" fill="#ffffff" />
      <path d="M17 50h30" stroke="#d7bafc" stroke-width="4.5" stroke-linecap="round" />
    </svg>
    @if (conTexto()) {
      <span class="texto">Sevilla<span class="renace">Renace</span></span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    .texto { font-family: var(--font-marca); font-size: 1.02rem; color: var(--color-tinta); letter-spacing: -0.02em; }
    .renace { color: var(--color-accion); }
    .hoja { transform-box: fill-box; animation: brotar 900ms var(--ease-salida) both; }
    .hoja-der { transform-origin: left bottom; animation-delay: 120ms; }
    .hoja-izq { transform-origin: right bottom; animation-delay: 240ms; }
    :host(:hover) .hoja-der { animation: mecer 1.2s ease-in-out; }
    @keyframes brotar { from { transform: scale(0.2); opacity: 0; } }
    @keyframes mecer { 50% { transform: rotate(-8deg); } }
  `,
})
export class Marca {
  readonly tamano = input(36);
  readonly conTexto = input(true);
}

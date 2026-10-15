import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar, avatarDe } from '../../shared/lib/avatar';

const MAX_CABECITAS = 4;

/**
 * Llamado a ayudar flotando sobre el mapa. Muestra las cabecitas de quienes
 * estan ayudando ahora: ver a otros vecinos en accion invita a sumarse.
 */
@Component({
  selector: 'sr-cta-ayudar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/necesidades" class="cta">
      @if (cabecitas().length) {
        <span class="pila" aria-hidden="true">
          @for (c of cabecitas(); track c.nombre; let i = $index) {
            <span class="cabecita" [style.--av]="c.color" [style.--i]="i" [title]="c.nombre">{{ c.inicial }}</span>
          }
          @if (resto() > 0) {
            <span class="cabecita mas">+{{ resto() }}</span>
          }
        </span>
      } @else {
        <span class="corazon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
        </span>
      }
      <span class="textos">
        <strong>Quiero ayudar</strong>
        <small>{{ subtitulo() }}</small>
      </span>
      <svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </a>
  `,
  styles: `
    :host { display: block; }
    .cta { display: inline-flex; align-items: center; gap: 12px; padding: 10px 18px 10px 10px; border-radius: var(--radius-pill); background: linear-gradient(135deg, #6a4fe0, #2b4cf2); color: #fff; text-decoration: none; box-shadow: 0 14px 34px rgba(43, 76, 242, .35), 0 0 0 4px rgba(255, 255, 255, .9); animation: llegar 700ms cubic-bezier(.22, 1, .36, 1) 600ms both, brillo 3.2s ease-in-out 1.6s infinite; transition: transform .2s; }
    .cta:hover { transform: translateY(-2px) scale(1.02); }
    .cta:active { transform: scale(.97); }
    .pila { display: inline-flex; padding-left: 6px; }
    .cabecita { width: 34px; height: 34px; margin-left: -10px; display: grid; place-items: center; border-radius: 50%; border: 2.5px solid #fff; background: var(--av, #fff); color: #fff; font-weight: 800; font-size: 14px; animation: asomar 480ms cubic-bezier(.34, 1.56, .64, 1) both; animation-delay: calc(900ms + var(--i, 0) * 110ms); }
    .cabecita.mas { --av: rgba(255, 255, 255, .25); font-size: 12px; }
    .corazon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, .2); }
    .corazon svg { width: 20px; height: 20px; fill: #fff; animation: latir 1.4s ease-in-out infinite; }
    .textos { display: grid; line-height: 1.15; }
    strong { font-size: var(--text-md); }
    small { font-size: 12px; opacity: .88; }
    .flecha { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; transition: transform .2s; }
    .cta:hover .flecha { transform: translateX(3px); }
    @keyframes llegar { from { opacity: 0; transform: translateY(24px) scale(.9); } }
    @keyframes asomar { from { opacity: 0; transform: translateY(10px) scale(.5); } }
    @keyframes brillo { 50% { box-shadow: 0 14px 40px rgba(106, 79, 224, .55), 0 0 0 4px rgba(255, 255, 255, .9); } }
    @keyframes latir { 50% { transform: scale(1.15); } }
    @media (prefers-reduced-motion: reduce) { .cta, .cabecita, .corazon svg { animation: none; } }
  `,
})
export class CtaAyudar {
  /** Nombres publicos de quienes estan llevando una ayuda ahora. */
  readonly ayudantes = input.required<readonly string[]>();
  /** Familias esperando ayuda (para el subtitulo cuando nadie esta ayudando). */
  readonly esperando = input(0);

  protected readonly cabecitas = computed<readonly Avatar[]>(() => this.ayudantes().slice(0, MAX_CABECITAS).map(avatarDe));
  protected readonly resto = computed(() => Math.max(0, this.ayudantes().length - MAX_CABECITAS));
  protected readonly subtitulo = computed(() => {
    const n = this.ayudantes().length;
    if (n > 0) return n === 1 ? '1 vecino ayudando ahora' : `${n} vecinos ayudando ahora`;
    const e = this.esperando();
    return e === 1 ? '1 familia espera tu ayuda' : `${e} familias esperan tu ayuda`;
  });
}

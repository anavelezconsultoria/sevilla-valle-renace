import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CifrasPublicas } from '../../core/domain/necesidad.model';
import { Contador } from '../../shared/ui/contador';

/** Contador pequeno de la portada: siempre visible, lleva a la comunidad. */
@Component({
  selector: 'sr-contador-ayudas',
  imports: [RouterLink, Contador],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = cifras();
    <a routerLink="/comunidad" class="contador" aria-label="Ver la comunidad">
      <span class="punto" aria-hidden="true"></span>
      <span><strong [srContador]="c.personasAyudadas"></strong> personas ayudadas</span>
      <span class="separador" aria-hidden="true">·</span>
      <span><strong [srContador]="c.atendidas"></strong> ayudas</span>
      <span class="flecha" aria-hidden="true">→</span>
    </a>
  `,
  styles: `
    :host { display: block; }
    .contador { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-pill); background: var(--color-accion-suave); color: var(--color-tinta); font-size: var(--text-xs); text-decoration: none; transition: background-color var(--dur-corta) var(--ease-salida); }
    .contador:hover { background: var(--color-acento-suave); }
    strong { font-weight: 750; color: var(--color-primario); font-variant-numeric: tabular-nums; }
    .punto { width: 7px; height: 7px; border-radius: 50%; background: var(--color-primario); animation: pulso 1.8s infinite; }
    @keyframes pulso { 50% { opacity: .3; transform: scale(.7); } }
    .separador { color: var(--color-tenue); }
    .flecha { color: var(--color-primario); transition: transform var(--dur-corta) var(--ease-salida); }
    .contador:hover .flecha { transform: translateX(3px); }
    @media (prefers-reduced-motion: reduce) { .punto { animation: none; } }
  `,
})
export class ContadorAyudas {
  readonly cifras = input.required<CifrasPublicas>();
}

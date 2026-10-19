import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CifrasAyudas } from './cifras-ayudas';
import { MuroComunidad } from './muro-comunidad';
import { VecinosQueAyudan } from './vecinos-que-ayudan';

type PestanaComunidad = 'muro' | 'vecinos' | 'cifras';

interface PestanaInfo {
  readonly id: PestanaComunidad;
  readonly etiqueta: string;
  readonly icono: string;
}

const PESTANA_INICIAL: PestanaComunidad = 'muro';

const PESTANAS: readonly PestanaInfo[] = [
  { id: 'muro', etiqueta: 'Comunidad', icono: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z' },
  { id: 'vecinos', etiqueta: 'Vecinos que han ayudado', icono: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7' },
  { id: 'cifras', etiqueta: 'Cifras de las ayudas', icono: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

function esPestana(valor: string | undefined): valor is PestanaComunidad {
  return PESTANAS.some((p) => p.id === valor);
}

/**
 * Red social solidaria: el muro, los vecinos que ayudan y las cifras, en
 * pestanas. La pestana activa vive en la URL (?pestana=...) para compartirla.
 */
@Component({
  selector: 'sr-comunidad-page',
  imports: [RouterLink, MuroComunidad, VecinosQueAyudan, CifrasAyudas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="encabezado-pagina">
      <div class="container encabezado">
        <p class="eyebrow">Comunidad</p>
        <h1>Lo que Sevilla está logrando junta</h1>
      </div>
    </header>

    <nav class="pestanas" aria-label="Secciones de la comunidad">
      <div class="container riel" role="tablist">
        @for (p of pestanas; track p.id) {
          <a
            role="tab"
            class="pestana"
            routerLink="/comunidad"
            [queryParams]="{ pestana: p.id === inicial ? null : p.id }"
            [class.activa]="activa() === p.id"
            [attr.aria-selected]="activa() === p.id"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icono" /></svg>
            <span>{{ p.etiqueta }}</span>
          </a>
        }
      </div>
    </nav>

    <div class="container contenido" role="tabpanel">
      @switch (activa()) {
        @case ('vecinos') {
          <sr-vecinos-que-ayudan />
        }
        @case ('cifras') {
          <sr-cifras-ayudas />
        }
        @default {
          <sr-muro-comunidad />
        }
      }
    </div>
  `,
  styles: `
    .encabezado { display: grid; gap: var(--space-2); }
    .encabezado h1 { font-size: var(--text-2xl); }
    .pestanas { position: sticky; top: var(--header-height); z-index: 20; background: color-mix(in srgb, var(--color-fondo) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-linea); }
    .riel { display: flex; gap: var(--space-2); padding-block: var(--space-3); overflow-x: auto; scrollbar-width: none; }
    .riel::-webkit-scrollbar { display: none; }
    .pestana { display: inline-flex; align-items: center; gap: 8px; flex: none; min-height: 40px; padding: 0 16px; border-radius: var(--radius-pill); color: var(--color-tenue); font-size: var(--text-sm); font-weight: 650; text-decoration: none; transition: background-color .25s, color .25s, box-shadow .25s; }
    .pestana:hover { color: var(--color-tinta); }
    .pestana.activa { background: var(--color-superficie); color: var(--color-primario); box-shadow: 0 6px 18px rgba(106, 79, 224, .18); }
    .pestana svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .contenido { padding-block: var(--space-6); }
    @media (max-width: 560px) {
      .riel { gap: 2px; }
      .pestana { flex: 1 1 0; flex-direction: column; gap: 2px; min-height: 52px; padding: 6px 4px; border-radius: var(--radius-md); font-size: 11px; text-align: center; line-height: 1.2; }
    }
  `,
})
export class ComunidadPage {
  /** Viene de la URL (?pestana=...) gracias al enlace de inputs del router. */
  readonly pestana = input<string>();

  protected readonly pestanas = PESTANAS;
  protected readonly inicial = PESTANA_INICIAL;
  protected readonly activa = computed<PestanaComunidad>(() => {
    const pedida = this.pestana();
    return esPestana(pedida) ? pedida : PESTANA_INICIAL;
  });
}

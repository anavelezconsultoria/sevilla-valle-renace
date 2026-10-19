import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicacionMuro } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { avatarDe } from '../../shared/lib/avatar';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { CategoriaIcono } from '../../shared/ui/categoria-icono';

/**
 * Una publicacion del muro: quien ayudo, que llevo, en que sector y cuando.
 * Nunca muestra datos de la familia. El boton "Gracias" late al tocarlo.
 */
@Component({
  selector: 'sr-publicacion-card',
  imports: [CategoriaIcono, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = publicacion();
    <article class="card publicacion">
      <header class="cabecera">
        @if (avatar(); as a) {
          <span class="avatar" [style.--av]="a.color" aria-hidden="true">{{ a.inicial }}</span>
        } @else {
          <span class="avatar familia" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" /></svg>
          </span>
        }
        <div class="quien">
          @if (p.tipo === 'entrega') {
            <p><strong>{{ p.ayudante ?? 'Un vecino' }}</strong> entregó una ayuda de <strong>{{ categoria() }}</strong> a una familia de {{ p.personasHogar }} {{ p.personasHogar === 1 ? 'persona' : 'personas' }} en <strong>{{ p.sector }}</strong></p>
          } @else {
            <p>Una familia en <strong>{{ p.sector }}</strong> confirmó que le llegó la ayuda @if (p.ayudante) { de <strong>{{ p.ayudante }}</strong>}</p>
          }
          <span class="cuando">{{ hace() }}</span>
        </div>
        <sr-categoria-icono class="icono-cat" [categoria]="p.categoria" [tamano]="34" />
      </header>

      @if (p.foto) {
        <img class="foto" [src]="p.foto" alt="Foto de la entrega (sin rostros)" loading="lazy" decoding="async" />
      }

      <footer class="pie">
        <button
          type="button"
          class="gracias"
          [class.dada]="yaDio()"
          [class.latiendo]="latiendo()"
          [disabled]="yaDio()"
          [attr.aria-pressed]="yaDio()"
          (click)="agradecer.emit(p.eventoId)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></svg>
          <span>{{ yaDio() ? '¡Gracias!' : 'Gracias' }}</span>
        </button>
        @if (p.gracias > 0) {
          <span class="total">{{ p.gracias }} {{ p.gracias === 1 ? 'persona agradeció' : 'personas agradecieron' }}</span>
        }
        @if (necesidadId(); as id) {
          <a class="reportar" [routerLink]="['/necesidades', id]" [queryParams]="{ reportar: 1 }">Reportar</a>
        }
      </footer>
    </article>
  `,
  styles: `
    .publicacion { display: grid; gap: var(--space-3); padding: var(--space-4); }
    .cabecera { display: flex; gap: var(--space-3); align-items: flex-start; }
    .avatar { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--av, var(--color-primario)); color: #fff; font-family: var(--font-marca); font-size: var(--text-md); box-shadow: 0 0 0 3px var(--color-superficie), 0 0 0 5px color-mix(in srgb, var(--av, #6a4fe0) 30%, transparent); }
    .avatar.familia { background: var(--color-montana-suave); color: var(--color-montana); box-shadow: none; }
    .avatar.familia svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .quien { flex: 1; min-width: 0; display: grid; gap: 4px; }
    .quien p { font-size: var(--text-sm); line-height: 1.45; color: var(--color-texto); }
    .quien strong { color: var(--color-tinta); }
    .cuando { font-size: var(--text-xs); color: var(--color-tenue); }
    .icono-cat { flex: none; }
    .foto { width: 100%; aspect-ratio: 16 / 10; max-height: 320px; object-fit: cover; border-radius: var(--radius-md); background: var(--color-arena); }
    .pie { display: flex; align-items: center; gap: var(--space-3); }
    .gracias { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 16px; border: 1.5px solid var(--color-linea-fuerte); border-radius: var(--radius-pill); background: var(--color-superficie); color: var(--color-texto); font: inherit; font-size: var(--text-sm); font-weight: 650; cursor: pointer; transition: background-color .2s, border-color .2s, color .2s, transform .15s; }
    .gracias:hover:not(:disabled) { border-color: var(--color-primario); color: var(--color-primario); }
    .gracias:active:not(:disabled) { transform: scale(.95); }
    .gracias svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; transition: fill .2s; }
    .reportar { margin-left: auto; font-size: var(--text-xs); font-weight: 600; color: var(--color-tenue); text-decoration: underline; text-underline-offset: 3px; }
    .reportar:hover { color: var(--color-tinta); }
    .gracias.dada { border-color: var(--color-aviso-borde); background: var(--color-primario-suave); color: var(--color-primario); cursor: default; }
    .gracias.dada svg { fill: var(--color-primario); stroke: var(--color-primario); }
    .gracias.latiendo svg { animation: latir 600ms cubic-bezier(.34, 1.56, .64, 1); }
    @keyframes latir { 30% { transform: scale(1.45); } 60% { transform: scale(.9); } }
    .total { font-size: var(--text-xs); color: var(--color-tenue); }
  `,
})
export class PublicacionCard {
  readonly publicacion = input.required<PublicacionMuro>();
  readonly yaDio = input(false);
  /** Solicitud de esta publicacion, para reportar mal uso. */
  readonly necesidadId = input<string>();
  /** Recien agradecida: el corazon late una vez. */
  readonly latiendo = input(false);
  readonly agradecer = output<string>();

  protected readonly avatar = computed(() => {
    const p = this.publicacion();
    return p.tipo === 'entrega' && p.ayudante ? avatarDe(p.ayudante) : null;
  });
  protected readonly categoria = computed(() => infoCategoria(this.publicacion().categoria).etiqueta);
  protected readonly hace = computed(() => tiempoRelativo(this.publicacion().ocurridoEn));
}

import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CoordinacionGateway, HogarAtendido } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { tiempoRelativo } from '../../shared/lib/tiempo';

/**
 * Herramienta de la coordinacion: hogares que ya recibieron ayuda, el mas
 * reciente primero. Privado. Tocar uno abre su historial completo.
 */
@Component({
  selector: 'sr-hogares-atendidos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Hogares que han recibido ayuda</h2>
      <p class="muted">Privado: nombres y celulares nunca se publican. Toca un hogar para ver todo su historial.</p>

      @if (cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!hogares().length) {
        <p class="vacio">Todavía ningún hogar ha recibido una ayuda registrada.</p>
      } @else {
        <input class="input" [value]="filtro()" (input)="alFiltrar($event)" type="search" placeholder="Buscar por nombre, sector o celular" aria-label="Buscar hogar" />
        <p class="total">{{ visibles().length }} {{ visibles().length === 1 ? 'hogar' : 'hogares' }}</p>
        <ul class="lista">
          @for (h of visibles(); track h.telefono) {
            <li>
              <button type="button" class="item" (click)="elegir.emit(h.telefono)">
                <span class="fila">
                  <strong>{{ h.nombre }}</strong>
                  <span class="conteo" [class.varias]="h.ayudas > 1">{{ h.ayudas }} {{ h.ayudas === 1 ? 'ayuda' : 'ayudas' }}</span>
                </span>
                <span class="muted">{{ h.sector }} · {{ h.telefono }}</span>
                <span class="muted">{{ categorias(h) }} · última {{ hace(h) }}</span>
              </button>
            </li>
          }
        </ul>
      }
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); margin-top: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .total { font-size: var(--text-xs); color: var(--color-tenue); }
    .lista { display: grid; gap: var(--space-2); list-style: none; margin: 0; padding: 0; max-height: 480px; overflow-y: auto; }
    .item { display: grid; gap: 2px; width: 100%; padding: var(--space-3); border: 1px solid var(--color-linea); border-radius: var(--radius-sm); background: var(--color-superficie); font: inherit; text-align: left; cursor: pointer; }
    .item:hover { border-color: var(--color-linea-fuerte); }
    .fila { display: flex; justify-content: space-between; gap: var(--space-2); }
    .item .muted { font-size: var(--text-xs); }
    .conteo { font-size: var(--text-xs); font-weight: 700; color: var(--color-montana); white-space: nowrap; }
    .conteo.varias { color: var(--color-acento); }
    .vacio { font-size: var(--text-sm); color: var(--color-tenue); }
  `,
})
export class HogaresAtendidos {
  private readonly coordinacion = inject(CoordinacionGateway);

  /** Celular del hogar elegido, para abrir su historial. */
  readonly elegir = output<string>();

  protected readonly hogares = signal<readonly HogarAtendido[]>([]);
  protected readonly filtro = signal('');
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly visibles = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) return this.hogares();
    return this.hogares().filter((h) => `${h.nombre} ${h.sector} ${h.telefono}`.toLowerCase().includes(texto));
  });

  constructor() {
    void this.cargar();
  }

  protected alFiltrar(evento: Event): void {
    this.filtro.set((evento.target as HTMLInputElement).value);
  }

  protected categorias(h: HogarAtendido): string {
    return h.categorias.map((c) => infoCategoria(c).etiqueta).join(', ');
  }

  protected hace(h: HogarAtendido): string {
    return tiempoRelativo(h.ultimaAyuda);
  }

  private async cargar(): Promise<void> {
    try {
      this.hogares.set(await this.coordinacion.hogaresQueRecibieron());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la lista de hogares.');
    } finally {
      this.cargando.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { Categoria, EstadoNecesidad, Urgencia } from '../../core/domain/necesidad.model';
import { CATEGORIAS, ESTADOS, URGENCIAS } from '../../core/domain/catalogos';
import { ESTADOS_ACTIVOS } from '../../core/domain/ciclo-de-vida';
import { NecesidadCard } from '../../shared/ui/necesidad-card';
import { MapaNecesidades } from '../../shared/mapa/mapa-necesidades';

type Vista = 'lista' | 'mapa';

@Component({
  selector: 'sr-tablero-page',
  imports: [RouterLink, NecesidadCard, MapaNecesidades],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container cabecera">
      <div>
        <p class="eyebrow">Tablero de necesidades</p>
        <h1>¿A quién puedes ayudar hoy?</h1>
        <p class="muted">Elige una necesidad, tómala y llévala hasta la entrega. Primero aparece lo más urgente y lo que lleva más tiempo esperando.</p>
      </div>
      <a routerLink="/pedir-ayuda" class="btn btn-primary">Registrar una necesidad</a>
    </section>

    <section class="container filtros" aria-label="Filtros">
      <div class="segmento" role="tablist" aria-label="Estado">
        @for (opcion of opcionesEstado; track opcion.valor) {
          <button type="button" role="tab" [attr.aria-selected]="estado() === opcion.valor" (click)="estado.set(opcion.valor)">
            {{ opcion.etiqueta }}
          </button>
        }
      </div>
      <select class="input" aria-label="Categoría" (change)="alCambiarCategoria($event)">
        <option value="">Todas las categorías</option>
        @for (c of categorias; track c.valor) {
          <option [value]="c.valor">{{ c.etiqueta }}</option>
        }
      </select>
      <select class="input" aria-label="Urgencia" (change)="alCambiarUrgencia($event)">
        <option value="">Cualquier urgencia</option>
        @for (u of urgencias; track u[0]) {
          <option [value]="u[0]">{{ u[1] }}</option>
        }
      </select>
      <input class="input" type="search" placeholder="Buscar sector o palabra..." (input)="alBuscar($event)" aria-label="Buscar" />
      <div class="vista" role="group" aria-label="Vista">
        <button type="button" [class.activo]="vista() === 'lista'" (click)="vista.set('lista')">Lista</button>
        <button type="button" [class.activo]="vista() === 'mapa'" (click)="vista.set('mapa')">Mapa</button>
      </div>
    </section>

    <section class="container">
      <p class="conteo muted">{{ resultados().length }} {{ resultados().length === 1 ? 'necesidad' : 'necesidades' }}</p>
      @if (vista() === 'mapa') {
        <sr-mapa-necesidades class="mapa card" [necesidades]="resultados()" (seleccionar)="seleccionadaId.set($event)" [seleccionadaId]="seleccionadaId()" />
      }
      <div class="grid">
        @for (n of resultados(); track n.id) {
          <sr-necesidad-card [necesidad]="n" />
        } @empty {
          <div class="vacio card">
            <p><strong>No hay necesidades con estos filtros.</strong></p>
            <p class="muted">Prueba con otra categoría o estado.</p>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .cabecera { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-4); padding-block: var(--space-6) var(--space-5); }
    .cabecera h1 { font-size: var(--text-2xl); margin-block: 6px; }
    .cabecera p.muted { max-width: 620px; }
    .filtros { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4); }
    .filtros select, .filtros input { width: auto; min-width: 180px; flex: 1; min-height: 42px; }
    .segmento, .vista { display: inline-flex; padding: 3px; gap: 2px; background: var(--color-surface); border: 1px solid var(--color-line-strong); border-radius: var(--radius-pill); }
    .segmento button, .vista button { border: 0; background: none; padding: 7px 14px; border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 550; color: var(--color-muted); cursor: pointer; }
    .segmento button[aria-selected='true'], .vista button.activo { background: var(--color-blue); color: #fff; }
    .conteo { font-size: var(--text-sm); margin-bottom: var(--space-3); }
    .mapa { display: block; height: 420px; overflow: hidden; margin-bottom: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: var(--space-3); }
    .vacio { padding: var(--space-6); text-align: center; grid-column: 1 / -1; }
    @media (max-width: 640px) { .filtros select, .filtros input { min-width: 0; flex-basis: 100%; } .segmento { width: 100%; overflow-x: auto; } }
  `,
})
export class TableroPage {
  private readonly lectura = inject(NecesidadesLectura);

  protected readonly categorias = CATEGORIAS;
  protected readonly urgencias = Object.entries(URGENCIAS) as [Urgencia, string][];
  protected readonly opcionesEstado: readonly { valor: EstadoNecesidad | 'activas'; etiqueta: string }[] = [
    { valor: 'activas', etiqueta: 'Activas' },
    { valor: EstadoNecesidad.Registrada, etiqueta: ESTADOS[EstadoNecesidad.Registrada].etiqueta },
    { valor: EstadoNecesidad.EnAtencion, etiqueta: ESTADOS[EstadoNecesidad.EnAtencion].etiqueta },
    { valor: EstadoNecesidad.Atendida, etiqueta: ESTADOS[EstadoNecesidad.Atendida].etiqueta },
  ];

  protected readonly estado = signal<EstadoNecesidad | 'activas'>('activas');
  protected readonly categoria = signal<Categoria | undefined>(undefined);
  protected readonly urgencia = signal<Urgencia | undefined>(undefined);
  protected readonly texto = signal('');
  protected readonly vista = signal<Vista>('lista');
  protected readonly seleccionadaId = signal<string | null>(null);

  protected readonly resultados = computed(() =>
    this.lectura.filtrar({
      estados: this.estado() === 'activas' ? ESTADOS_ACTIVOS : [this.estado() as EstadoNecesidad],
      categoria: this.categoria(),
      urgencia: this.urgencia(),
      texto: this.texto(),
    }),
  );

  protected alCambiarCategoria(evento: Event): void {
    this.categoria.set(((evento.target as HTMLSelectElement).value || undefined) as Categoria | undefined);
  }

  protected alCambiarUrgencia(evento: Event): void {
    this.urgencia.set(((evento.target as HTMLSelectElement).value || undefined) as Urgencia | undefined);
  }

  protected alBuscar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }
}

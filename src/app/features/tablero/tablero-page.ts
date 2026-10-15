import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { Categoria, EstadoNecesidad, Urgencia } from '../../core/domain/necesidad.model';
import { CATEGORIAS, ESTADOS, URGENCIAS } from '../../core/domain/catalogos';
import { NecesidadCard } from '../../shared/ui/necesidad-card';
import { MapaNecesidades } from '../../shared/mapa/mapa-necesidades';
import { Revelar } from '../../shared/ui/revelar';

type Vista = 'lista' | 'mapa';

@Component({
  selector: 'sr-tablero-page',
  imports: [RouterLink, NecesidadCard, MapaNecesidades, Revelar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="encabezado-pagina"><div class="container cabecera">
      <div>
        <p class="eyebrow">Tablero de necesidades</p>
        <h1>¿A quién puedes ayudar hoy?</h1>
        <p class="muted">Elige una necesidad, tómala y llévala hasta la entrega. Primero aparece lo más urgente y lo que lleva más tiempo esperando.</p>
      </div>
      <a routerLink="/pedir-ayuda" class="btn btn-secondary">Necesito ayuda: registrar</a>
    </div></header>

    <section class="container" style="margin-top: var(--space-5)">
      <div class="pestanas" role="tablist" aria-label="Estado">
        @for (opcion of opcionesEstado; track opcion.valor) {
          <button type="button" role="tab" class="pestana" [attr.data-estado]="opcion.valor" [attr.aria-selected]="estado() === opcion.valor" (click)="estado.set(opcion.valor)">
            <span>{{ opcion.etiqueta }}</span><span class="num">{{ conteos()[opcion.valor] }}</span>
          </button>
        }
      </div>
    </section>

    <details class="container mas-filtros" [open]="filtrosAbiertos">
      <summary>Filtrar por categoría, urgencia o sector</summary>
    <section class="filtros" aria-label="Filtros">
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
    </details>

    <section class="container">
      <p class="conteo muted">{{ resultados().length }} {{ resultados().length === 1 ? 'necesidad' : 'necesidades' }}</p>
      @if (vista() === 'mapa') {
        <sr-mapa-necesidades class="mapa card" [necesidades]="resultados()" (seleccionar)="seleccionadaId.set($event)" [seleccionadaId]="seleccionadaId()" />
      }
      <div class="grid">
        @for (n of resultados(); track n.id; let i = $index) {
          <sr-necesidad-card srRevelar [style.--i]="i % 3" [necesidad]="n" />
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
    .cabecera { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-4); }
    .cabecera h1 { font-size: var(--text-2xl); margin-block: 6px; }
    .cabecera p.muted { max-width: 620px; }
    .pestanas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-3); }
    .pestana { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; padding: 10px 16px; border: 1.5px solid var(--color-linea-fuerte); border-radius: var(--radius-md); background: var(--color-superficie); font: inherit; font-size: var(--text-sm); font-weight: 650; color: var(--color-tenue); text-align: left; cursor: pointer; }
    .pestana .num { min-width: 30px; height: 30px; padding-inline: 8px; display: grid; place-items: center; border-radius: 999px; background: var(--color-arena); color: var(--color-tinta); font-weight: 800; }
    .pestana[aria-selected='true'] { color: #fff; }
    .pestana[aria-selected='true'] .num { background: rgba(255,255,255,.9); }
    .pestana[data-estado='registrada'][aria-selected='true'] { background: var(--estado-pendiente); border-color: var(--estado-pendiente); }
    .pestana[data-estado='en_atencion'][aria-selected='true'] { background: var(--estado-progreso); border-color: var(--estado-progreso); }
    .pestana[data-estado='entregada'][aria-selected='true'] { background: var(--estado-entregada); border-color: var(--estado-entregada); }
    .pestana[data-estado='atendida'][aria-selected='true'] { background: var(--estado-exito); border-color: var(--estado-exito); }
    .mas-filtros { margin-bottom: var(--space-3); }
    .mas-filtros summary { display: none; }
    .filtros { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4); }
    .filtros select, .filtros input { width: auto; min-width: 180px; flex: 1; min-height: 42px; }
    .segmento, .vista { display: inline-flex; padding: 3px; gap: 2px; background: var(--color-superficie); border: 1px solid var(--color-linea-fuerte); border-radius: var(--radius-pill); }
    .segmento button, .vista button { border: 0; background: none; padding: 7px 14px; border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 550; color: var(--color-tenue); cursor: pointer; }
    .segmento button[aria-selected='true'], .vista button.activo { background: var(--color-primario); color: #fff; }
    .conteo { font-size: var(--text-sm); margin-bottom: var(--space-3); }
    .mapa { display: block; height: 420px; overflow: hidden; margin-bottom: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: var(--space-3); }
    .vacio { padding: var(--space-6); text-align: center; grid-column: 1 / -1; }
    @media (max-width: 640px) {
      .cabecera p.muted { display: none; }
      .cabecera .btn { align-self: flex-start; }
      .pestanas { grid-template-columns: 1fr 1fr; }
      .mas-filtros summary { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 16px; border: 1.5px solid var(--color-linea-fuerte); border-radius: var(--radius-md); background: var(--color-superficie); font-weight: 650; color: var(--color-primario); cursor: pointer; list-style: none; }
      .mas-filtros summary::-webkit-details-marker { display: none; }
      .mas-filtros[open] summary { margin-bottom: var(--space-2); }
      .filtros select, .filtros input { min-width: 0; flex-basis: 100%; }
    }
  `,
})
export class TableroPage {
  private readonly lectura = inject(NecesidadesLectura);

  protected readonly categorias = CATEGORIAS;
  protected readonly urgencias = Object.entries(URGENCIAS) as [Urgencia, string][];
  /** Por defecto se ve lo que espera ayuda: es lo que hay que atender. */
  protected readonly opcionesEstado: readonly { valor: EstadoNecesidad; etiqueta: string }[] = [
    { valor: EstadoNecesidad.Registrada, etiqueta: ESTADOS[EstadoNecesidad.Registrada].etiqueta },
    { valor: EstadoNecesidad.EnAtencion, etiqueta: ESTADOS[EstadoNecesidad.EnAtencion].etiqueta },
    { valor: EstadoNecesidad.Entregada, etiqueta: 'Entregadas' },
    { valor: EstadoNecesidad.Atendida, etiqueta: 'Atendidas' },
  ];
  /** En escritorio los filtros se ven siempre; en celular van plegados (CSS). */
  protected readonly filtrosAbiertos = typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches;

  protected readonly estado = signal<EstadoNecesidad>(EstadoNecesidad.Registrada);
  protected readonly conteos = computed(() => {
    const todas = this.lectura.todas();
    const contar = (e: EstadoNecesidad) => todas.filter((n) => n.estado === e).length;
    return {
      [EstadoNecesidad.Registrada]: contar(EstadoNecesidad.Registrada),
      [EstadoNecesidad.EnRevision]: 0,
      [EstadoNecesidad.EnAtencion]: contar(EstadoNecesidad.EnAtencion),
      [EstadoNecesidad.Entregada]: contar(EstadoNecesidad.Entregada),
      [EstadoNecesidad.Atendida]: contar(EstadoNecesidad.Atendida),
      [EstadoNecesidad.Cancelada]: contar(EstadoNecesidad.Cancelada),
    } satisfies Record<EstadoNecesidad, number>;
  });
  protected readonly categoria = signal<Categoria | undefined>(undefined);
  protected readonly urgencia = signal<Urgencia | undefined>(undefined);
  protected readonly texto = signal('');
  protected readonly vista = signal<Vista>('lista');
  protected readonly seleccionadaId = signal<string | null>(null);

  protected readonly resultados = computed(() =>
    this.lectura.filtrar({
      estados: [this.estado()],
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

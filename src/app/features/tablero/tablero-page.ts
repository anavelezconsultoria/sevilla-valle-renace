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
            <span class="num">{{ conteos()[opcion.valor] }}</span><span class="etiqueta">{{ opcion.etiqueta }}</span>
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
    /* Tabla de estados: una sola fila, numero arriba y etiqueta abajo. */
    .pestanas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: var(--space-3); border: 1px solid var(--color-linea); border-radius: var(--radius-md); background: var(--color-superficie); overflow: hidden; }
    .pestana { position: relative; display: grid; justify-items: center; gap: 2px; padding: 10px 4px 12px; border: 0; border-left: 1px solid var(--color-linea); background: none; font: inherit; color: var(--color-tenue); cursor: pointer; transition: background-color .2s, color .2s; }
    .pestana:first-child { border-left: 0; }
    .pestana:hover { background: var(--color-fondo); }
    .pestana .num { font-family: var(--font-titulo); font-size: var(--text-lg); font-weight: 700; line-height: 1.1; color: var(--color-tinta); font-variant-numeric: tabular-nums; }
    .pestana .etiqueta { font-size: var(--text-xs); font-weight: 600; text-align: center; line-height: 1.2; }
    .pestana::after { content: ''; position: absolute; left: 12%; right: 12%; bottom: 0; height: 3px; border-radius: 3px 3px 0 0; background: var(--tono); opacity: 0; transition: opacity .2s; }
    .pestana[aria-selected='true'] { background: color-mix(in srgb, var(--tono) 9%, var(--color-superficie)); color: var(--color-tinta); }
    .pestana[aria-selected='true'] .num { color: var(--tono); }
    .pestana[aria-selected='true']::after { opacity: 1; }
    .pestana[data-estado='registrada'] { --tono: var(--color-espera); }
    .pestana[data-estado='en_atencion'] { --tono: var(--estado-progreso); }
    .pestana[data-estado='entregada'] { --tono: var(--estado-entregada); }
    .pestana[data-estado='atendida'] { --tono: var(--estado-exito); }
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
      .mas-filtros summary { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 14px; border: 1px solid var(--color-linea); border-radius: var(--radius-pill); background: var(--color-superficie); font-size: var(--text-sm); font-weight: 650; width: fit-content; color: var(--color-primario); cursor: pointer; list-style: none; }
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

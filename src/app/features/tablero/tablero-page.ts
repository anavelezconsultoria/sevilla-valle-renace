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

    <section class="container controles">
      <div class="estados" role="tablist" aria-label="Estado">
        @for (opcion of opcionesEstado; track opcion.valor) {
          <button type="button" role="tab" class="estado" [attr.data-estado]="opcion.valor" [attr.aria-selected]="estado() === opcion.valor" (click)="estado.set(opcion.valor)">
            <span class="num">{{ conteos()[opcion.valor] }}</span>
            <span class="etiqueta">{{ opcion.etiqueta }}</span>
          </button>
        }
      </div>

      <div class="herramientas">
        <label class="buscar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3" /></svg>
          <input type="search" placeholder="Buscar sector o palabra" (input)="alBuscar($event)" aria-label="Buscar sector o palabra" />
        </label>
        <button type="button" class="boton-filtros" [class.abierto]="filtrosAbiertos()" [attr.aria-expanded]="filtrosAbiertos()" aria-controls="filtros-tablero" (click)="filtrosAbiertos.set(!filtrosAbiertos())">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          <span>Filtros</span>
          @if (filtrosActivos()) {
            <span class="insignia">{{ filtrosActivos() }}</span>
          }
        </button>
        <div class="filtros" id="filtros-tablero" [class.abierto]="filtrosAbiertos()">
          <select aria-label="Categoría" (change)="alCambiarCategoria($event)">
            <option value="">Todas las categorías</option>
            @for (c of categorias; track c.valor) {
              <option [value]="c.valor">{{ c.etiqueta }}</option>
            }
          </select>
          <select aria-label="Urgencia" (change)="alCambiarUrgencia($event)">
            <option value="">Cualquier urgencia</option>
            @for (u of urgencias; track u[0]) {
              <option [value]="u[0]">{{ u[1] }}</option>
            }
          </select>
        </div>
        <div class="vista" role="group" aria-label="Vista">
          <button type="button" [class.activo]="vista() === 'lista'" [attr.aria-pressed]="vista() === 'lista'" (click)="vista.set('lista')" title="Lista">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            <span>Lista</span>
          </button>
          <button type="button" [class.activo]="vista() === 'mapa'" [attr.aria-pressed]="vista() === 'mapa'" (click)="vista.set('mapa')" title="Mapa">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
            <span>Mapa</span>
          </button>
        </div>
      </div>
    </section>

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
    .controles { display: grid; gap: var(--space-3); margin-block: var(--space-5) var(--space-4); }

    /* Estados: misma linea que las pestanas de Comunidad; el numero hace de icono. */
    .estados { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
    .estado { display: grid; justify-items: center; align-content: center; gap: 4px; min-height: 64px; padding: 8px 4px; border: 0; border-radius: var(--radius-md); background: transparent; font: inherit; color: var(--color-tenue); cursor: pointer; transition: background-color .25s, color .25s, box-shadow .25s, transform .2s; }
    .estado:hover { color: var(--color-tinta); }
    .estado:active { transform: scale(.96); }
    .estado:focus-visible { outline: 2px solid var(--color-primario); outline-offset: 2px; }
    .estado .num { font-family: var(--font-titulo); font-size: 1.3rem; font-weight: 700; line-height: 1; color: var(--tono); font-variant-numeric: tabular-nums; }
    .estado .etiqueta { font-size: var(--text-sm); font-weight: 650; line-height: 1.2; text-align: center; }
    .estado[aria-selected='true'] { background: var(--color-superficie); color: var(--color-primario); box-shadow: 0 6px 18px rgba(106, 79, 224, .18); }
    .estado[data-estado='registrada'] { --tono: var(--color-espera); }
    .estado[data-estado='en_atencion'] { --tono: var(--estado-progreso); }
    .estado[data-estado='entregada'] { --tono: var(--estado-entregada); }
    .estado[data-estado='atendida'] { --tono: var(--estado-exito); }

    /* Herramientas: buscar, filtros y vista, compactas y a la misma altura. */
    .herramientas { --alto: 40px; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding-top: var(--space-3); border-top: 1px solid var(--color-linea); }
    .buscar { flex: 1 1 220px; display: flex; align-items: center; gap: 8px; height: var(--alto); padding: 0 14px; border: 1px solid var(--color-linea); border-radius: var(--radius-pill); background: var(--color-superficie); color: var(--color-tenue); transition: border-color .2s, box-shadow .2s; }
    .buscar:focus-within { border-color: var(--color-primario); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primario) 15%, transparent); }
    .buscar input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: none; font: inherit; font-size: var(--text-sm); color: var(--color-tinta); }
    .filtros { display: flex; gap: var(--space-2); }
    .filtros select { height: var(--alto); min-width: 0; padding: 0 34px 0 14px; border: 1px solid var(--color-linea); border-radius: var(--radius-pill); background: var(--color-superficie) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236a4fe0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center / 14px; appearance: none; font: inherit; font-size: var(--text-sm); color: var(--color-tinta); cursor: pointer; }
    .filtros select:focus-visible { outline: 0; border-color: var(--color-primario); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primario) 15%, transparent); }
    .boton-filtros { display: none; align-items: center; gap: 6px; height: var(--alto); padding: 0 14px; border: 1px solid var(--color-linea); border-radius: var(--radius-pill); background: var(--color-superficie); font: inherit; font-size: var(--text-sm); font-weight: 650; color: var(--color-primario); cursor: pointer; }
    .boton-filtros.abierto { background: var(--color-superficie); border-color: transparent; box-shadow: 0 6px 18px rgba(106, 79, 224, .18); }
    .insignia { min-width: 18px; height: 18px; padding: 0 5px; display: grid; place-items: center; border-radius: 9px; background: var(--color-primario); color: #fff; font-size: 11px; font-weight: 700; }
    .herramientas svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .vista { display: inline-flex; height: var(--alto); padding: 3px; gap: 2px; border: 1px solid var(--color-linea); border-radius: var(--radius-pill); background: var(--color-superficie); }
    .vista button { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 0; border-radius: var(--radius-pill); background: none; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-tenue); cursor: pointer; transition: background-color .2s, color .2s; }
    .vista button.activo { background: var(--color-primario); color: #fff; }
    .conteo { font-size: var(--text-sm); margin-bottom: var(--space-3); }
    .mapa { display: block; height: 420px; overflow: hidden; margin-bottom: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: var(--space-3); }
    .vacio { padding: var(--space-6); text-align: center; grid-column: 1 / -1; }
    @media (max-width: 640px) {
      .cabecera p.muted { display: none; }
      .cabecera .btn { align-self: flex-start; }
      .estados { gap: 2px; }
      .estado { min-height: 60px; }
      .estado .etiqueta { font-size: 11px; }
      .buscar { flex-basis: 100%; }
      .boton-filtros { display: inline-flex; }
      .vista { margin-left: auto; }
      .vista button span { display: none; }
      .filtros { display: none; order: 5; flex-basis: 100%; }
      .filtros.abierto { display: grid; grid-template-columns: 1fr 1fr; }
    }
  `,
})
export class TableroPage {
  private readonly lectura = inject(NecesidadesLectura);

  protected readonly categorias = CATEGORIAS;
  protected readonly urgencias = Object.entries(URGENCIAS) as [Urgencia, string][];
  /** Por defecto se ve lo que espera ayuda: es lo que hay que atender. */
  protected readonly opcionesEstado: readonly { valor: EstadoNecesidad; etiqueta: string }[] = [
    { valor: EstadoNecesidad.Registrada, etiqueta: 'Esperando' },
    { valor: EstadoNecesidad.EnAtencion, etiqueta: ESTADOS[EstadoNecesidad.EnAtencion].etiqueta },
    { valor: EstadoNecesidad.Entregada, etiqueta: 'Entregadas' },
    { valor: EstadoNecesidad.Atendida, etiqueta: 'Atendidas' },
  ];
  /** En escritorio los filtros se ven siempre (CSS); en celular se despliegan con el boton. */
  protected readonly filtrosAbiertos = signal(false);

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
  /** Cuantos filtros hay puestos, para avisarlo en el boton plegado. */
  protected readonly filtrosActivos = computed(() => Number(!!this.categoria()) + Number(!!this.urgencia()));
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

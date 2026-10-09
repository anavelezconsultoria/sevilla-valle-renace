import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { infoCategoria, URGENCIAS } from '../../core/domain/catalogos';
import { CategoriaIcono } from '../../shared/ui/categoria-icono';
import { EstadoBadge } from '../../shared/ui/estado-badge';
import { LineaTiempo } from '../../shared/ui/linea-tiempo';
import { MapaNecesidades } from '../../shared/mapa/mapa-necesidades';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { PanelAyudante } from './panel-ayudante';

@Component({
  selector: 'sr-detalle-page',
  imports: [RouterLink, CategoriaIcono, EstadoBadge, LineaTiempo, MapaNecesidades, PanelAyudante],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <a routerLink="/necesidades" class="volver">← Volver al tablero</a>
      @if (necesidad(); as n) {
        <div class="layout">
          <article class="principal">
            <header class="card cabecera">
              <div class="titulo">
                <sr-categoria-icono [categoria]="n.categoria" [tamano]="52" />
                <div>
                  <p class="eyebrow">{{ categoria()?.etiqueta }}</p>
                  <h1>{{ n.titulo }}</h1>
                </div>
              </div>
              <div class="chips">
                <sr-estado-badge [estado]="n.estado" [cierre]="n.cierre" />
                <span class="chip" [class.urgente]="n.urgencia === 'alta'">{{ urgencia() }}</span>
                <span class="chip">{{ n.personasHogar }} {{ n.personasHogar === 1 ? 'persona' : 'personas' }}</span>
                <span class="chip">{{ n.sector }}</span>
                <span class="chip">Registrada {{ hace() }}</span>
              </div>
              <p class="descripcion">{{ n.descripcion }}</p>
            </header>

            <section class="card bloque">
              <h2>Seguimiento</h2>
              <sr-linea-tiempo [eventos]="n.eventos" />
            </section>
          </article>

          <aside class="lateral">
            <sr-panel-ayudante [necesidad]="n" />
            <section class="card mapa-card">
              <sr-mapa-necesidades class="mapa" [necesidades]="[n]" [seleccionadaId]="n.id" />
              <p class="nota-mapa">Ubicación aproximada. La dirección exacta solo la ve quien atiende.</p>
            </section>
          </aside>
        </div>
      } @else {
        <div class="card vacio">
          <h1>No encontramos esta necesidad</h1>
          <p class="muted">Puede que el enlace esté mal escrito.</p>
          <a routerLink="/necesidades" class="btn btn-primary">Ver todas las necesidades</a>
        </div>
      }
    </div>
  `,
  styles: `
    .pagina { padding-block: var(--space-5) var(--space-6); }
    .volver { display: inline-block; margin-bottom: var(--space-4); font-size: var(--text-sm); font-weight: 600; color: var(--color-blue); text-decoration: none; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: var(--space-4); align-items: start; }
    .principal, .lateral { display: grid; gap: var(--space-4); }
    .lateral { position: sticky; top: calc(var(--header-height) + 16px); }
    .cabecera { display: grid; gap: var(--space-4); padding: var(--space-5); }
    .titulo { display: flex; gap: var(--space-4); align-items: center; }
    h1 { font-size: var(--text-xl); line-height: 1.25; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { font-size: var(--text-xs); font-weight: 550; padding: 3px 10px; border-radius: var(--radius-pill); background: var(--color-lavender-soft); color: var(--color-text); }
    .chip.urgente { background: var(--estado-pendiente-bg); color: var(--urgencia-alta); }
    .descripcion { font-size: var(--text-md); line-height: 1.65; }
    .bloque { padding: var(--space-5); display: grid; gap: var(--space-4); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .mapa-card { overflow: hidden; }
    .mapa { display: block; height: 220px; }
    .nota-mapa { font-size: var(--text-xs); color: var(--color-muted); padding: var(--space-3) var(--space-4); }
    .vacio { padding: var(--space-6); display: grid; gap: var(--space-3); justify-items: start; }
    @media (max-width: 960px) { .layout { grid-template-columns: minmax(0, 1fr); } .lateral { position: static; } }
  `,
})
export class DetallePage {
  private readonly lectura = inject(NecesidadesLectura);
  /** Viene del parametro de ruta :id (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly necesidad = computed(() => {
    this.lectura.todas();
    return this.lectura.obtener(this.id());
  });
  protected readonly categoria = computed(() => {
    const n = this.necesidad();
    return n ? infoCategoria(n.categoria) : null;
  });
  protected readonly urgencia = computed(() => {
    const n = this.necesidad();
    return n ? URGENCIAS[n.urgencia] : '';
  });
  protected readonly hace = computed(() => {
    const n = this.necesidad();
    return n ? tiempoRelativo(n.registradaEn) : '';
  });
}

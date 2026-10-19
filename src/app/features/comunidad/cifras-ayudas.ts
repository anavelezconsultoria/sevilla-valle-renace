import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { CierreAtencion, EstadoNecesidad, Evidencia, Necesidad, TipoEvento } from '../../core/domain/necesidad.model';
import { infoCategoria } from '../../core/domain/catalogos';
import { ultimo } from '../../core/domain/listas';
import { CategoriaIcono } from '../../shared/ui/categoria-icono';
import { fechaCorta } from '../../shared/lib/tiempo';
import { Contador } from '../../shared/ui/contador';
import { Revelar } from '../../shared/ui/revelar';

interface AyudaEntregada {
  readonly necesidad: Necesidad;
  readonly categoria: string;
  readonly entregadaEn: string;
  readonly nota?: string;
  readonly evidencias: readonly Evidencia[];
}

function aAyudaEntregada(n: Necesidad): AyudaEntregada {
  const entrega = ultimo(n.eventos, (e) => e.tipo === TipoEvento.Entregada);
  return {
    necesidad: n,
    categoria: infoCategoria(n.categoria).etiqueta,
    entregadaEn: entrega?.ocurridoEn ?? n.actualizadaEn,
    nota: entrega?.nota,
    evidencias: entrega?.evidencias ?? [],
  };
}

/**
 * Registro publico de ayudas entregadas: la memoria del proceso.
 * Confirmadas y cerradas sin reclamo se cuentan por separado y nunca se suman en una sola cifra sin decirlo.
 */
@Component({
  selector: 'sr-cifras-ayudas',
  imports: [RouterLink, CategoriaIcono, Contador, Revelar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pagina">
      <p class="muted intro">Cada ayuda queda registrada con quién la llevó, cuándo y, si la hay, una foto sin rostros de lo que se entregó.</p>
      <dl class="cifras">
        <div class="card entrada"><dt>Necesidades atendidas</dt><dd [srContador]="ayudas().length"></dd></div>
        <div class="card entrada" style="--i: 1"><dt>Personas ayudadas</dt><dd [srContador]="personas()"></dd></div>
        <div class="card entrada" style="--i: 2"><dt>Confirmadas por quien recibió</dt><dd [srContador]="confirmadas()"></dd></div>
        <div class="card entrada" style="--i: 3"><dt>Cerradas sin reclamo en 48 h</dt><dd [srContador]="automaticas()"></dd></div>
      </dl>

      <div class="lista">
        @for (a of ayudas(); track a.necesidad.id; let i = $index) {
          <article class="card ayuda" srRevelar [style.--i]="i % 3">
            @if (a.evidencias.length) {
              <a class="foto" [routerLink]="['/necesidades', a.necesidad.id]">
                <img [src]="a.evidencias[0].url" [alt]="a.evidencias[0].descripcion" loading="lazy" />
                @if (a.evidencias.length > 1) {
                  <span class="mas">+{{ a.evidencias.length - 1 }}</span>
                }
              </a>
            } @else {
              <div class="foto sin-foto"><sr-categoria-icono [categoria]="a.necesidad.categoria" [tamano]="56" /></div>
            }
            <div class="cuerpo">
              <p class="meta">{{ a.categoria }} · {{ a.necesidad.sector }}</p>
              <h2><a [routerLink]="['/necesidades', a.necesidad.id]">{{ a.necesidad.titulo }}</a></h2>
              @if (a.nota) {
                <p class="nota">“{{ a.nota }}”</p>
              }
              <p class="pie">
                Entregó <strong>{{ a.necesidad.ayudanteAlias }}</strong> · {{ fecha(a.entregadaEn) }}
                <span class="cierre" [class.auto]="a.necesidad.cierre === 'cerrada_automaticamente'">
                  {{ a.necesidad.cierre === 'confirmada' ? 'Confirmada' : 'Sin reclamo' }}
                </span>
              </p>
            </div>
          </article>
        } @empty {
          <div class="card vacio">
            <p><strong>Todavía no hay ayudas cerradas.</strong></p>
            <p class="muted">Cuando una necesidad se entregue y se confirme, aparecerá aquí.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .pagina { display: grid; gap: var(--space-5); }
    .intro { max-width: 640px; }
    .cifras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin: 0; }
    .cifras div { padding: var(--space-4); }
    dt { font-size: var(--text-xs); color: var(--color-tenue); }
    dd { margin: 4px 0 0; font-family: var(--font-titulo); font-weight: 650; font-size: 2rem; line-height: 1.1; color: var(--color-montana); font-variant-numeric: tabular-nums; }
    .lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: var(--space-4); }
    .ayuda { overflow: hidden; display: grid; grid-template-rows: auto 1fr; transition: transform var(--dur-corta) var(--ease-salida), box-shadow var(--dur-corta); }
    .ayuda:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .foto img { transition: transform 600ms var(--ease-salida); }
    .ayuda:hover .foto img { transform: scale(1.04); }
    .foto { overflow: hidden; }
    .foto { position: relative; display: block; aspect-ratio: 4 / 3; background: var(--color-arena); }
    .foto img { width: 100%; height: 100%; object-fit: cover; }
    .sin-foto { display: grid; place-items: center; aspect-ratio: 4 / 3; }
    .mas { position: absolute; right: 10px; bottom: 10px; padding: 2px 10px; border-radius: var(--radius-pill); background: rgba(0,0,0,.6); color: #fff; font-size: var(--text-xs); font-weight: 700; }
    .cuerpo { display: grid; gap: var(--space-2); padding: var(--space-4); align-content: start; }
    .meta { font-size: var(--text-xs); color: var(--color-tenue); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    h2 a { text-decoration: none; }
    h2 a:hover { color: var(--color-primario); }
    .nota { font-size: var(--text-sm); font-style: italic; }
    .pie { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: var(--text-xs); color: var(--color-tenue); }
    .cierre { padding: 2px 8px; border-radius: var(--radius-pill); background: var(--estado-exito-bg); color: var(--estado-exito); font-weight: 650; }
    .cierre.auto { background: var(--estado-neutro-bg); color: var(--estado-neutro); }
    .vacio { padding: var(--space-6); text-align: center; grid-column: 1 / -1; }
    @media (max-width: 760px) { .cifras { grid-template-columns: 1fr 1fr; } }
  `,
})
export class CifrasAyudas {
  private readonly lectura = inject(NecesidadesLectura);
  protected readonly fecha = fechaCorta;

  protected readonly ayudas = computed(() =>
    this.lectura
      .filtrar({ estados: [EstadoNecesidad.Atendida] })
      .map(aAyudaEntregada)
      .sort((a, b) => new Date(b.entregadaEn).getTime() - new Date(a.entregadaEn).getTime()),
  );
  /** Incluye las ayudas entregadas por fuera de la plataforma, igual que el mapa. */
  protected readonly personas = computed(() => this.lectura.cifras().personasAyudadas);
  protected readonly confirmadas = computed(() => this.ayudas().filter((a) => a.necesidad.cierre === CierreAtencion.Confirmada).length);
  protected readonly automaticas = computed(() => this.ayudas().filter((a) => a.necesidad.cierre === CierreAtencion.Automatica).length);
}

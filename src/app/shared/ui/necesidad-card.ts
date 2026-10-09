import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Necesidad, Urgencia } from '../../core/domain/necesidad.model';
import { infoCategoria, URGENCIAS } from '../../core/domain/catalogos';
import { tiempoRelativo } from '../lib/tiempo';
import { CategoriaIcono } from './categoria-icono';
import { EstadoBadge } from './estado-badge';

@Component({
  selector: 'sr-necesidad-card',
  imports: [RouterLink, CategoriaIcono, EstadoBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let n = necesidad();
    <a class="card tarjeta" [routerLink]="['/necesidades', n.id]" [class.compacta]="compacta()">
      <div class="cabecera">
        <sr-categoria-icono [categoria]="n.categoria" [tamano]="compacta() ? 36 : 42" />
        <div class="titulos">
          <h3>{{ n.titulo }}</h3>
          <p class="meta">{{ categoria().etiqueta }} · {{ n.sector }}</p>
        </div>
      </div>
      @if (!compacta()) {
        <p class="descripcion">{{ n.descripcion }}</p>
      }
      <div class="pie">
        <sr-estado-badge [estado]="n.estado" [cierre]="n.cierre" />
        @if (esUrgente()) {
          <span class="urgente">{{ urgencia() }}</span>
        }
        <span class="personas">{{ n.personasHogar }} {{ n.personasHogar === 1 ? 'persona' : 'personas' }}</span>
        <span class="hace">{{ hace() }}</span>
      </div>
    </a>
  `,
  styles: `
    .tarjeta { display: grid; gap: var(--space-3); padding: var(--space-4); text-decoration: none; transition: border-color .15s, box-shadow .15s, transform .15s; }
    .tarjeta:hover { border-color: var(--color-lavender); box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .compacta { padding: var(--space-3) var(--space-4); gap: var(--space-2); box-shadow: none; }
    .cabecera { display: flex; gap: var(--space-3); align-items: center; }
    .titulos { min-width: 0; }
    h3 { font-size: var(--text-md); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .meta { font-size: var(--text-xs); color: var(--color-muted); margin-top: 2px; }
    .descripcion { font-size: var(--text-sm); color: var(--color-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .pie { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: var(--text-xs); color: var(--color-muted); }
    .urgente { color: var(--urgencia-alta); font-weight: 650; }
    .hace { margin-left: auto; }
  `,
})
export class NecesidadCard {
  readonly necesidad = input.required<Necesidad>();
  readonly compacta = input(false);
  protected readonly categoria = computed(() => infoCategoria(this.necesidad().categoria));
  protected readonly esUrgente = computed(() => this.necesidad().urgencia === Urgencia.Alta);
  protected readonly urgencia = computed(() => URGENCIAS[this.necesidad().urgencia]);
  protected readonly hace = computed(() => tiempoRelativo(this.necesidad().registradaEn));
}

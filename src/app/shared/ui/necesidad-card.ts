import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoNecesidad, Necesidad, Urgencia } from '../../core/domain/necesidad.model';
import { esGestionExterna, infoCategoria, URGENCIAS } from '../../core/domain/catalogos';
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
      @if (n.prioridadCero || gestionExterna() || senalHogar()) {
        <div class="marcas">
          @if (n.prioridadCero) {
            <span class="marca prioridad" title="En el hogar hay bebés o adultos mayores">Prioridad 0 · bebés o adultos mayores</span>
          }
          @if (gestionExterna()) {
            <span class="marca externa" title="Se gestiona con entidades externas: tarda un poco más">Gestión externa · puede tardar más</span>
          }
          @if (senalHogar(); as senal) {
            <span class="marca" [class.primera]="senal.primera" [class.reciente]="!senal.primera" [title]="senal.titulo">{{ senal.texto }}</span>
          }
        </div>
      }
      @if (!compacta() || descripcionVisible()) {
        <p class="descripcion">{{ n.descripcion }}</p>
      }
      <div class="pie">
        <sr-estado-badge [estado]="n.estado" [cierre]="n.cierre" [quien]="n.ayudanteAlias" />
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
    .tarjeta:hover { border-color: var(--color-linea-fuerte); box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .compacta { padding: var(--space-3) var(--space-4); gap: var(--space-2); box-shadow: none; }
    .cabecera { display: flex; gap: var(--space-3); align-items: center; }
    .titulos { min-width: 0; }
    h3 { font-size: var(--text-md); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .meta { font-size: var(--text-xs); color: var(--color-tenue); margin-top: 2px; }
    .descripcion { font-size: var(--text-sm); color: var(--color-tenue); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .pie { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: var(--text-xs); color: var(--color-tenue); }
    .urgente { color: var(--urgencia-alta); font-weight: 650; }
    .marcas { display: flex; flex-wrap: wrap; gap: 6px; }
    .marca { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 650; }
    .prioridad { color: #fff; background: #c8431f; }
    .externa { color: #5a4a3a; background: #efe7dd; }
    .primera { color: var(--color-montana); background: var(--color-montana-suave); }
    .reciente { color: var(--color-tenue); background: var(--color-arena); }
    .hace { margin-left: auto; }
  `,
})
export class NecesidadCard {
  readonly necesidad = input.required<Necesidad>();
  readonly compacta = input(false);
  /** En listas compactas, mostrar igual la descripcion (por ejemplo, en Mi panel). */
  readonly descripcionVisible = input(false);
  protected readonly gestionExterna = computed(() => esGestionExterna(this.necesidad().categoria));
  protected readonly categoria = computed(() => infoCategoria(this.necesidad().categoria));
  protected readonly esUrgente = computed(() => this.necesidad().urgencia === Urgencia.Alta);
  protected readonly urgencia = computed(() => URGENCIAS[this.necesidad().urgencia]);
  protected readonly hace = computed(() => tiempoRelativo(this.necesidad().registradaEn));
  /**
   * Senal neutra para repartir mejor, sin nombres: solo mientras espera ayuda.
   * Ayuda a que quien ayuda elija primero a quien todavia no ha recibido nada.
   */
  protected readonly senalHogar = computed<SenalHogar | null>(() => {
    const n = this.necesidad();
    if (n.estado !== EstadoNecesidad.Registrada) return null;
    if (n.ayudaRecienteCategoria) {
      const recibida = infoCategoria(n.ayudaRecienteCategoria).etiqueta.toLowerCase();
      return { primera: false, texto: `Ya recibió ${recibida} esta semana`, titulo: 'Este hogar recibió ayuda en los últimos 7 días' };
    }
    return n.primeraSolicitud ? { primera: true, texto: 'Primera solicitud', titulo: 'Es la primera vez que este hogar pide ayuda' } : null;
  });
}

interface SenalHogar {
  readonly primera: boolean;
  readonly texto: string;
  readonly titulo: string;
}

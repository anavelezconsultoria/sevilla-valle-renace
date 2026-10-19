import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoordinacionGateway, ReportePendiente } from '../../core/ports/necesidades.ports';
import { ESTADOS, infoCategoria } from '../../core/domain/catalogos';
import { MOTIVOS_REPORTE } from '../../core/domain/reporte-mal-uso';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { CoordinacionEstado } from './coordinacion-estado';

/**
 * Herramienta de la coordinacion: solicitudes que los vecinos reportaron por
 * mal uso (por ejemplo, vender las ayudas). Regla: llamar antes de bloquear;
 * un reporte solo no prueba nada.
 */
@Component({
  selector: 'sr-reportes-vecinos',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="herramienta">
      <h2>Reportes de vecinos</h2>
      <p class="muted">Solicitudes que alguien reportó por mal uso. Los reportes son anónimos. <strong>Llama antes de bloquear:</strong> un reporte solo no prueba nada.</p>

      @if (!estado.reportes().length) {
        <p class="vacio">Sin reportes pendientes.</p>
      } @else {
        <ul class="lista">
          @for (r of estado.reportes(); track r.necesidadId) {
            <li class="card item entrada">
              <div class="encabezado">
                <strong>{{ r.titulo }}</strong>
                <span class="muted">{{ categoria(r) }} · {{ r.sector }} · {{ estadoDe(r) }}</span>
              </div>
              <p class="cuantos" [class.varios]="r.reportes > 1">
                {{ r.reportes }} {{ r.reportes === 1 ? 'reporte' : 'reportes' }} · el último {{ hace(r) }}
              </p>
              <ul class="motivos">
                @for (m of r.motivos; track m) {
                  <li>{{ motivo(m) }}</li>
                }
              </ul>
              @for (n of r.notas; track $index) {
                <p class="nota">«{{ n }}»</p>
              }
              <p class="contacto">{{ r.nombre }} · <a [href]="'tel:+57' + r.telefono">{{ r.telefono }}</a></p>
              <div class="acciones">
                <a class="btn btn-ghost" [routerLink]="['/necesidades', r.necesidadId]">Ver solicitud</a>
                <button type="button" class="btn btn-ghost peligro" [disabled]="ocupado() === r.necesidadId" (click)="bloquear(r)">Bloquear celular</button>
                <button type="button" class="btn btn-ghost" [disabled]="ocupado() === r.necesidadId" (click)="descartar(r)">Ya lo revisé</button>
              </div>
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
    .herramienta { display: grid; gap: var(--space-3); margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--color-linea); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .item { display: grid; gap: var(--space-2); padding: var(--space-4); }
    .encabezado { display: grid; gap: 2px; }
    .encabezado .muted { font-size: var(--text-xs); }
    .cuantos { font-size: var(--text-sm); font-weight: 650; }
    .cuantos.varios { color: var(--color-espera-texto); }
    .motivos { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; list-style: none; }
    .motivos li { padding: 3px 10px; border-radius: var(--radius-pill); background: var(--color-acento-suave); font-size: var(--text-xs); font-weight: 600; }
    .nota { font-size: var(--text-sm); color: var(--color-texto); font-style: italic; }
    .contacto { font-size: var(--text-sm); }
    .acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .peligro { color: var(--color-espera-texto); }
    .vacio { font-size: var(--text-sm); color: var(--color-montana); font-weight: 600; }
  `,
})
export class ReportesVecinos {
  protected readonly estado = inject(CoordinacionEstado);
  private readonly coordinacion = inject(CoordinacionGateway);

  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected categoria(r: ReportePendiente): string {
    return infoCategoria(r.categoria).etiqueta;
  }

  protected estadoDe(r: ReportePendiente): string {
    return ESTADOS[r.estado].etiqueta;
  }

  protected motivo(m: ReportePendiente['motivos'][number]): string {
    return MOTIVOS_REPORTE[m];
  }

  protected hace(r: ReportePendiente): string {
    return tiempoRelativo(r.ultimo);
  }

  protected async bloquear(r: ReportePendiente): Promise<void> {
    if (!confirm(`¿Bloquear el celular ${r.telefono} de ${r.nombre}? No podrá publicar más solicitudes y se cerrará lo que tenga abierto.`)) return;
    await this.ejecutar(r, async () => {
      await this.coordinacion.bloquearCelular({ telefono: r.telefono, motivo: 'Reportes de vecinos por mal uso' });
      await this.estado.marcarReportesRevisados(r.necesidadId);
    });
  }

  protected async descartar(r: ReportePendiente): Promise<void> {
    await this.ejecutar(r, () => this.estado.marcarReportesRevisados(r.necesidadId));
  }

  private async ejecutar(r: ReportePendiente, accion: () => Promise<void>): Promise<void> {
    this.ocupado.set(r.necesidadId);
    this.error.set(null);
    try {
      await accion();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      this.ocupado.set(null);
    }
  }
}

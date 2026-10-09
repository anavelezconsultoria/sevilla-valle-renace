import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AyudanteGateway, SesionGateway } from '../../core/ports/necesidades.ports';
import { EstadoNecesidad, Necesidad } from '../../core/domain/necesidad.model';
import { NecesidadCard } from '../../shared/ui/necesidad-card';
import { IdentificarseForm } from '../sesion/identificarse-form';

interface Columna {
  readonly titulo: string;
  readonly ayuda: string;
  readonly necesidades: readonly Necesidad[];
}

/** Tablero de seguimiento de quien ayuda: lo que tengo en curso, lo que espera confirmacion y lo resuelto. */
@Component({
  selector: 'sr-mis-atenciones-page',
  imports: [RouterLink, NecesidadCard, IdentificarseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      @if (ayudante(); as a) {
        <header class="encabezado">
          <div>
            <p class="eyebrow">Mi panel</p>
            <h1>Hola, {{ a.alias }}</h1>
            <p class="muted">Has ayudado a <strong>{{ personasAyudadas() }}</strong> personas. Gracias por estar.</p>
          </div>
          <div class="acciones">
            <a routerLink="/necesidades" class="btn btn-primary">Buscar a quién ayudar</a>
            <button type="button" class="btn btn-ghost" (click)="salir()">Salir</button>
          </div>
        </header>

        <div class="columnas">
          @for (col of columnas(); track col.titulo) {
            <section class="columna">
              <div class="col-cabecera">
                <h2>{{ col.titulo }}</h2>
                <span class="conteo">{{ col.necesidades.length }}</span>
              </div>
              <p class="ayuda muted">{{ col.ayuda }}</p>
              <div class="tarjetas">
                @for (n of col.necesidades; track n.id) {
                  <sr-necesidad-card [necesidad]="n" [compacta]="true" />
                } @empty {
                  <p class="vacia">Nada por aquí.</p>
                }
              </div>
            </section>
          }
        </div>
      } @else {
        <section class="card acceso">
          <p class="eyebrow">Quiero ayudar</p>
          <h1>Identifícate para atender necesidades</h1>
          <p class="muted">Solo pedimos un nombre público y tu celular, que es privado. Entras al instante y quedas con tu historial de ayudas en este celular.</p>
          <sr-identificarse-form />
        </section>
      }
    </div>
  `,
  styles: `
    .pagina { padding-block: var(--space-6); }
    .encabezado { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-5); }
    .encabezado h1 { font-size: var(--text-2xl); margin-block: 4px; }
    .acciones { display: flex; gap: var(--space-2); }
    .columnas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
    .columna { display: grid; gap: var(--space-2); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--color-arena); }
    .col-cabecera { display: flex; justify-content: space-between; align-items: center; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    .conteo { min-width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--radius-pill); background: var(--color-superficie); font-weight: 700; font-size: var(--text-sm); }
    .ayuda { font-size: var(--text-xs); }
    .tarjetas { display: grid; gap: var(--space-2); }
    .vacia { font-size: var(--text-sm); color: var(--color-tenue); padding: var(--space-4); text-align: center; border: 1.5px dashed var(--color-linea-fuerte); border-radius: var(--radius-md); }
    .acceso { max-width: 520px; margin-inline: auto; padding: var(--space-6) var(--space-5); display: grid; gap: var(--space-3); }
    .acceso h1 { font-size: var(--text-xl); }
    @media (max-width: 960px) { .columnas { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class MisAtencionesPage {
  private readonly sesion = inject(SesionGateway);
  private readonly ayudanteGw = inject(AyudanteGateway);
  protected readonly ayudante = this.sesion.ayudante;

  private readonly mias = computed(() => {
    this.ayudante();
    return this.ayudanteGw.misAtenciones();
  });

  protected readonly columnas = computed<readonly Columna[]>(() => {
    const mias = this.mias();
    const en = (...estados: EstadoNecesidad[]) => mias.filter((n) => estados.includes(n.estado));
    return [
      { titulo: 'En curso', ayuda: 'Las tomaste y debes entregarlas en 48 horas.', necesidades: en(EstadoNecesidad.EnAtencion) },
      { titulo: 'Esperando confirmación', ayuda: 'Ya las entregaste. Se cierran solas en 48 horas si nadie reclama.', necesidades: en(EstadoNecesidad.Entregada) },
      { titulo: 'Atendidas', ayuda: 'Ayudas que llegaron. Tu historial.', necesidades: en(EstadoNecesidad.Atendida) },
    ];
  });

  protected readonly personasAyudadas = computed(() =>
    this.mias()
      .filter((n) => n.estado === EstadoNecesidad.Atendida)
      .reduce((total, n) => total + n.personasHogar, 0),
  );

  protected async salir(): Promise<void> {
    await this.sesion.cerrarSesion();
  }
}

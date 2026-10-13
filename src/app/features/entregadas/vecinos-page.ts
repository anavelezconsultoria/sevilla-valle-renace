import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReconocimientoLectura, VecinoQueAyuda } from '../../core/ports/necesidades.ports';
import { tiempoRelativo } from '../../shared/lib/tiempo';

/**
 * Reconocimiento publico: quienes han llevado ayuda, con el nombre que cada uno
 * eligio mostrar. Es un agradecimiento, no una competencia: no hay medallas ni
 * posiciones, solo cuantas entregas lleva cada vecino.
 */
@Component({
  selector: 'sr-vecinos-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="encabezado-pagina">
      <div class="container encabezado">
        <p class="eyebrow">Gracias</p>
        <h1>Vecinos que han ayudado</h1>
        <p class="muted">Cada nombre es alguien de Sevilla que llevó una ayuda hasta la puerta de una familia. Aparece el nombre que cada quien eligió mostrar.</p>
      </div>
    </header>
    <section class="container pagina">

      @if (cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!vecinos().length) {
        <div class="card vacio">
          <p>Todavía no hay entregas registradas.</p>
          <a routerLink="/necesidades" class="btn btn-primary">Ver quién necesita ayuda</a>
        </div>
      } @else {
        <ul class="lista">
          @for (v of vecinos(); track v.alias; let i = $index) {
            <li class="card vecino entrada" [style.--i]="i">
              <span class="inicial" aria-hidden="true">{{ inicial(v) }}</span>
              <div class="datos">
                <strong>{{ v.alias }}</strong>
                <span class="muted">Última entrega {{ hace(v) }}</span>
              </div>
              <span class="conteo">{{ v.entregas }} {{ v.entregas === 1 ? 'entrega' : 'entregas' }}</span>
            </li>
          }
        </ul>
        <div class="cierre">
          <a routerLink="/necesidades" class="btn btn-primary">Quiero ayudar también</a>
          <a routerLink="/ayudas-entregadas" class="btn btn-ghost">Ver las ayudas entregadas</a>
        </div>
      }
    </section>
  `,
  styles: `
    .encabezado { display: grid; gap: var(--space-2); }
    .encabezado h1 { font-size: var(--text-2xl); }
    .encabezado p.muted { max-width: 640px; }
    .pagina { max-width: 720px; padding-block: var(--space-6); display: grid; gap: var(--space-5); }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; }
    .vecino { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); }
    .inicial { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--color-accion-suave); color: var(--color-primario); font-family: var(--font-marca); font-size: var(--text-md); }
    .datos { display: grid; gap: 2px; min-width: 0; }
    .datos .muted { font-size: var(--text-xs); }
    .conteo { margin-left: auto; font-weight: 700; color: var(--color-montana); white-space: nowrap; }
    .vacio { display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-5); }
    .cierre { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  `,
})
export class VecinosPage {
  private readonly reconocimiento = inject(ReconocimientoLectura);

  protected readonly vecinos = signal<readonly VecinoQueAyuda[]>([]);
  protected readonly cargando = signal(true);

  constructor() {
    void this.cargar();
  }

  protected inicial(v: VecinoQueAyuda): string {
    return v.alias.trim().charAt(0).toUpperCase();
  }

  protected hace(v: VecinoQueAyuda): string {
    return tiempoRelativo(v.ultimaEntrega);
  }

  private async cargar(): Promise<void> {
    try {
      this.vecinos.set(await this.reconocimiento.vecinosQueAyudan());
    } catch {
      this.vecinos.set([]);
    } finally {
      this.cargando.set(false);
    }
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComunidadGateway, PublicacionMuro } from '../../core/ports/necesidades.ports';
import { graciasDadas, recordarGracias } from '../../shared/lib/dispositivo';
import { PublicacionCard } from './publicacion-card';

const POR_PAGINA = 15;

/**
 * Red social solidaria: el muro con lo que el pueblo va logrando. Se arma solo
 * con entregas y confirmaciones; cualquiera puede dar "Gracias" una vez.
 */
@Component({
  selector: 'sr-comunidad-page',
  imports: [RouterLink, PublicacionCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="encabezado-pagina">
      <div class="container encabezado">
        <p class="eyebrow">Comunidad</p>
        <h1>Lo que Sevilla está logrando junta</h1>
        <p class="muted">Cada entrega y cada familia que confirma que le llegó su ayuda aparece aquí. Dale las gracias a quien ayudó.</p>
        <nav class="atajos" aria-label="Más de la comunidad">
          <a routerLink="/vecinos-que-ayudan" class="atajo">Vecinos que han ayudado</a>
          <a routerLink="/ayudas-entregadas" class="atajo">Cifras de las ayudas</a>
        </nav>
      </div>
    </header>

    <section class="container pagina">
      @if (cargando() && !publicaciones().length) {
        <div class="lista">
          @for (i of [0, 1, 2]; track i) {
            <div class="card esqueleto" aria-hidden="true"></div>
          }
        </div>
      } @else if (!publicaciones().length) {
        <div class="card vacio">
          <p>Todavía no hay entregas. ¡La primera puede ser la tuya!</p>
          <a routerLink="/necesidades" class="btn btn-primary">Ver quién necesita ayuda</a>
        </div>
      } @else {
        <div class="lista">
          @for (p of publicaciones(); track p.eventoId; let i = $index) {
            <sr-publicacion-card
              class="entrada"
              [style.--i]="i % pagina"
              [publicacion]="p"
              [yaDio]="dadas().has(p.eventoId)"
              [latiendo]="recienDada() === p.eventoId"
              (agradecer)="agradecer($event)"
            />
          }
        </div>
        @if (hayMas()) {
          <button type="button" class="btn btn-ghost mas" [disabled]="cargando()" (click)="cargarMas()">
            {{ cargando() ? 'Cargando...' : 'Ver más' }}
          </button>
        }
      }
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
      <div class="cierre">
        <a routerLink="/necesidades" class="btn btn-primary">Quiero ayudar también</a>
      </div>
    </section>
  `,
  styles: `
    .encabezado { display: grid; gap: var(--space-2); }
    .encabezado h1 { font-size: var(--text-2xl); }
    .encabezado p.muted { max-width: 640px; }
    .atajos { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
    .atajo { padding: 8px 14px; border-radius: var(--radius-pill); background: var(--color-superficie); border: 1px solid var(--color-linea); color: var(--color-primario); font-size: var(--text-sm); font-weight: 650; text-decoration: none; }
    .atajo:hover { border-color: var(--color-linea-fuerte); }
    .pagina { padding-block: var(--space-6); display: grid; gap: var(--space-4); }
    .lista, .vacio, .mas, .cierre { max-width: 640px; width: 100%; }
    .lista { display: grid; gap: var(--space-3); }
    .esqueleto { height: 120px; background: linear-gradient(90deg, var(--color-arena) 0%, var(--color-superficie) 50%, var(--color-arena) 100%); background-size: 200% 100%; animation: brillo 1.4s ease-in-out infinite; }
    @keyframes brillo { to { background-position: -200% 0; } }
    .vacio { display: grid; justify-items: start; gap: var(--space-3); padding: var(--space-5); }
    .mas { justify-self: start; width: auto; }
    .cierre { margin-top: var(--space-3); }
  `,
})
export class ComunidadPage {
  private readonly comunidad = inject(ComunidadGateway);

  protected readonly pagina = POR_PAGINA;
  protected readonly publicaciones = signal<readonly PublicacionMuro[]>([]);
  protected readonly cargando = signal(true);
  protected readonly hayMas = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dadas = signal<ReadonlySet<string>>(graciasDadas());
  protected readonly recienDada = signal<string | null>(null);

  constructor() {
    void this.cargar();
  }

  protected cargarMas(): void {
    const lista = this.publicaciones();
    const ultima = lista[lista.length - 1];
    void this.cargar(ultima?.ocurridoEn);
  }

  protected async agradecer(eventoId: string): Promise<void> {
    if (this.dadas().has(eventoId)) return;
    // Optimista: se marca y suma al instante; si falla, se deshace.
    this.dadas.update((s) => new Set([...s, eventoId]));
    this.recienDada.set(eventoId);
    this.cambiarGracias(eventoId, (n) => n + 1);
    try {
      const total = await this.comunidad.darGracias(eventoId);
      recordarGracias(eventoId);
      this.cambiarGracias(eventoId, () => total);
    } catch (e) {
      this.dadas.update((s) => new Set([...s].filter((id) => id !== eventoId)));
      this.cambiarGracias(eventoId, (n) => Math.max(0, n - 1));
      this.error.set(e instanceof Error ? e.message : 'No se pudo enviar el gracias.');
    }
  }

  private cambiarGracias(eventoId: string, cambio: (actual: number) => number): void {
    this.publicaciones.update((lista) => lista.map((p) => (p.eventoId === eventoId ? { ...p, gracias: cambio(p.gracias) } : p)));
  }

  private async cargar(antes?: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const nuevas = await this.comunidad.muro({ antes, limite: POR_PAGINA });
      this.publicaciones.update((lista) => (antes ? [...lista, ...nuevas] : nuevas));
      this.hayMas.set(nuevas.length === POR_PAGINA);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar la comunidad.');
    } finally {
      this.cargando.set(false);
    }
  }
}

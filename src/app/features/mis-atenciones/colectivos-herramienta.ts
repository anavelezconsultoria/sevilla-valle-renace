import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SesionGateway } from '../../core/ports/necesidades.ports';
import { avatarDe } from '../../shared/lib/avatar';

/**
 * Coordinacion: colectivos a cuyo nombre se entrega (Baltimore-Maryland, una
 * parroquia). No necesitan celular propio: los maneja quien los crea, y al
 * atender una necesidad se elige "a nombre de quien".
 */
@Component({
  selector: 'sr-colectivos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Colectivos</h2>
      <p class="muted">Grupos a cuyo nombre entregas, como una campaña o una parroquia. No necesitan celular: los manejas tú y, al atender una necesidad, eliges a nombre de quién.</p>

      @if (sesion.colectivos().length) {
        <ul class="lista">
          @for (c of sesion.colectivos(); track c.id) {
            <li><span class="avatar" [style.--av]="color(c.alias)" aria-hidden="true">{{ c.alias.charAt(0).toUpperCase() }}</span>{{ c.alias }}</li>
          }
        </ul>
      }

      <form class="crear" (submit)="crear($event)">
        <input class="input" [value]="nombre()" (input)="nombre.set(valor($event))" maxlength="40" placeholder="Ej.: Baltimore-Maryland" aria-label="Nombre del colectivo" />
        <button type="submit" class="btn btn-primary" [disabled]="nombre().trim().length < 2 || ocupado()">{{ ocupado() ? 'Creando...' : 'Crear' }}</button>
      </form>
      @if (mensaje(); as m) {
        <p class="ok" role="status">{{ m }}</p>
      }
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .lista { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
    .lista li { display: inline-flex; align-items: center; gap: 8px; padding: 4px 14px 4px 4px; border-radius: var(--radius-pill); background: var(--color-primario-suave); font-size: var(--text-sm); font-weight: 650; color: var(--color-primario-fuerte); }
    .avatar { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--av); color: #fff; font-family: var(--font-marca); font-size: 12px; }
    .crear { display: flex; gap: var(--space-2); }
    .crear .input { flex: 1; min-width: 0; }
    .ok { font-size: var(--text-sm); font-weight: 600; color: var(--color-primario-fuerte); }
  `,
})
export class ColectivosHerramienta {
  protected readonly sesion = inject(SesionGateway);
  protected readonly nombre = signal('');
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  protected color(alias: string): string {
    return avatarDe(alias).color;
  }

  protected async crear(evento: Event): Promise<void> {
    evento.preventDefault();
    const alias = this.nombre().trim();
    this.ocupado.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    try {
      await this.sesion.crearColectivo(alias);
      this.nombre.set('');
      this.mensaje.set(`Listo: ya puedes atender necesidades a nombre de ${alias}.`);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo crear el colectivo.');
    } finally {
      this.ocupado.set(false);
    }
  }
}

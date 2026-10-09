import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegistroResultado } from '../../core/domain/necesidad.model';

/**
 * Pantalla final del registro. No hay codigo que guardar: este celular ya
 * recuerda la solicitud, y desde otro se entra con el celular y la clave.
 */
@Component({
  selector: 'sr-registro-exitoso',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container pagina">
      <div class="card exito entrada">
        <div class="check" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1>Tu necesidad quedó registrada</h1>
        <p class="muted">Ya aparece en el mapa para que alguien de Sevilla la tome.</p>

        <ol class="como-sigo">
          <li style="--i: 0">
            <span class="numero">1</span>
            <span><strong>Desde este celular</strong> la ves cuando quieras en «Mis solicitudes». No tienes que escribir nada.</span>
          </li>
          <li style="--i: 1">
            <span class="numero">2</span>
            <span><strong>Desde otro celular</strong> entras con tu número <strong>{{ telefono() }}</strong> y la clave de 4 números que creaste.</span>
          </li>
          <li style="--i: 2">
            <span class="numero">3</span>
            <span><strong>Cuando te llegue la ayuda</strong>, confírmalo. Si no alcanzas, se cierra sola 48 horas después de la entrega.</span>
          </li>
        </ol>

        <div class="siguiente">
          <a [routerLink]="['/seguimiento']" [queryParams]="{ necesidad: resultado().necesidad.id }" class="btn btn-primary">Ver mi solicitud</a>
          <button type="button" class="btn btn-ghost" (click)="otra.emit()">Registrar otra necesidad</button>
        </div>
      </div>
    </section>
  `,
  styles: `
    .pagina { max-width: 620px; padding-block: var(--space-7); }
    .exito { display: grid; justify-items: center; gap: var(--space-4); padding: var(--space-6) var(--space-5); text-align: center; }
    .check { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--estado-exito-bg); }
    .check { animation: latir 600ms var(--ease-salida) 200ms both; }
    .check svg { width: 32px; height: 32px; fill: none; stroke: var(--estado-exito); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .check path { stroke-dasharray: 24; stroke-dashoffset: 24; animation: trazar 500ms var(--ease-salida) 450ms forwards; }
    @keyframes trazar { to { stroke-dashoffset: 0; } }
    @keyframes latir { from { transform: scale(.4); opacity: 0; } }
    h1 { font-size: var(--text-xl); }
    .como-sigo { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); text-align: left; width: 100%; }
    .como-sigo li { display: grid; grid-template-columns: 32px 1fr; gap: var(--space-3); align-items: start; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--color-acento-suave); font-size: var(--text-sm); animation: aparecer var(--dur-media) var(--ease-salida) both; animation-delay: calc(600ms + var(--i) * 120ms); }
    .numero { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primario); color: #fff; font-weight: 700; }
    .siguiente { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); }
  `,
})
export class RegistroExitoso {
  readonly resultado = input.required<RegistroResultado>();
  /** Celular enmascarado, para que la persona recuerde cual uso. */
  readonly telefono = input.required<string>();
  readonly otra = output<void>();
}

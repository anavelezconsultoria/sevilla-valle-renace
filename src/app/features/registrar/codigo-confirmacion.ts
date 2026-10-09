import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegistroResultado } from '../../core/domain/necesidad.model';

/** Pantalla final del registro: el codigo se muestra una sola vez, asi que se facilita guardarlo. */
@Component({
  selector: 'sr-codigo-confirmacion',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container pagina">
      <div class="card exito">
        <div class="check" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h1>Tu necesidad quedó registrada</h1>
        <p class="muted">Ya aparece en el mapa para que alguien de Sevilla la tome. Guarda este código: con él sigues tu solicitud y confirmas cuando te llegue la ayuda.</p>

        <div class="codigo" aria-label="Código de seguimiento">{{ resultado().codigoSeguimiento }}</div>

        <div class="acciones">
          <button type="button" class="btn btn-secondary" (click)="copiar()">{{ copiado() ? 'Copiado' : 'Copiar código' }}</button>
          <a class="btn btn-whatsapp" [href]="enlaceWhatsapp()" target="_blank" rel="noopener">Guardarlo en WhatsApp</a>
        </div>

        <div class="aviso">
          <strong>Importante:</strong> no compartas este código con desconocidos. Quien lo tenga puede confirmar o cancelar tu solicitud.
        </div>

        <div class="siguiente">
          <a [routerLink]="['/seguimiento']" [queryParams]="{ codigo: resultado().codigoSeguimiento }" class="btn btn-primary">Ver el estado de mi solicitud</a>
          <button type="button" class="btn btn-ghost" (click)="otra.emit()">Registrar otra necesidad</button>
        </div>
      </div>
    </section>
  `,
  styles: `
    .pagina { max-width: 620px; padding-block: var(--space-7); }
    .exito { display: grid; justify-items: center; gap: var(--space-4); padding: var(--space-6) var(--space-5); text-align: center; }
    .check { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; background: var(--estado-exito-bg); }
    .check svg { width: 32px; height: 32px; fill: none; stroke: var(--estado-exito); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    h1 { font-size: var(--text-xl); }
    .codigo { font-family: var(--font-display); font-size: clamp(1.8rem, 6vw, 2.6rem); letter-spacing: .08em; color: var(--color-blue); padding: var(--space-3) var(--space-5); border: 2px dashed var(--color-lavender); border-radius: var(--radius-md); background: var(--color-lavender-soft); }
    .acciones, .siguiente { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); }
    .btn-whatsapp { background: #25d366; color: #fff; }
    .aviso { font-size: var(--text-sm); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); color: var(--color-text); text-align: left; }
  `,
})
export class CodigoConfirmacion {
  readonly resultado = input.required<RegistroResultado>();
  readonly otra = output<void>();
  protected readonly copiado = signal(false);

  protected readonly enlaceWhatsapp = computed(() => {
    const codigo = this.resultado().codigoSeguimiento;
    const texto = `Mi código de Sevilla Renace es ${codigo}. Sigo mi solicitud en ${location.origin}/seguimiento?codigo=${codigo}`;
    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
  });

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.resultado().codigoSeguimiento);
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }
}

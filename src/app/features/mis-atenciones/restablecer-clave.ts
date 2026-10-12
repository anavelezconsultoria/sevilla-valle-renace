import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CoordinacionGateway } from '../../core/ports/necesidades.ports';
import { LARGO_CLAVE, motivoClaveInvalida, soloDigitos } from '../../core/domain/clave-solicitante';

const LARGO_TELEFONO = 10;

/**
 * Herramienta de la coordinacion: asignar una clave nueva a quien la olvido.
 * Regla: ANTES de usarla, llamar al celular registrado y confirmar que contesta
 * la persona que pidio la ayuda (eso prueba que el celular es suyo).
 */
@Component({
  selector: 'sr-restablecer-clave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Asignar una clave nueva</h2>
      <p class="muted">Para quien olvidó su clave. <strong>Antes, llama a ese celular</strong> y confirma que contesta la persona que pidió la ayuda. Luego dile la clave nueva por teléfono.</p>
      <form (submit)="asignar($event)">
        <label class="field">
          <span class="field-label">Celular de quien pidió la ayuda</span>
          <input class="input" [value]="telefono()" (input)="alEscribirTelefono($event)" type="tel" inputmode="numeric" placeholder="3001234567" />
        </label>
        <label class="field">
          <span class="field-label">Clave nueva (4 números)</span>
          <input class="input clave" [value]="clave()" (input)="alEscribirClave($event)" type="text" inputmode="numeric" placeholder="••••" />
        </label>
        @if (motivo(); as m) {
          <p class="field-error">{{ m }}</p>
        }
        <button type="submit" class="btn btn-primary" [disabled]="!listo() || ocupado()">{{ ocupado() ? 'Asignando...' : 'Asignar clave nueva' }}</button>
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
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); margin-top: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    form { display: grid; gap: var(--space-3); }
    .clave { font-family: var(--font-marca); letter-spacing: .4em; max-width: 180px; }
    .ok { font-size: var(--text-sm); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--estado-exito-bg); color: var(--estado-exito); font-weight: 600; }
  `,
})
export class RestablecerClave {
  private readonly coordinacion = inject(CoordinacionGateway);

  protected readonly telefono = signal('');
  protected readonly clave = signal('');
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly motivo = computed(() =>
    this.clave().length === LARGO_CLAVE ? motivoClaveInvalida({ clave: this.clave(), telefono: this.telefono() }) : null,
  );
  protected readonly listo = computed(
    () => this.telefono().length === LARGO_TELEFONO && this.clave().length === LARGO_CLAVE && !this.motivo(),
  );

  protected alEscribirTelefono(evento: Event): void {
    this.telefono.set(this.limpiar(evento, LARGO_TELEFONO));
  }

  protected alEscribirClave(evento: Event): void {
    this.clave.set(this.limpiar(evento, LARGO_CLAVE));
  }

  protected async asignar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (!this.listo()) return;
    this.ocupado.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    try {
      const cambiadas = await this.coordinacion.restablecerClave({ telefono: this.telefono(), clave: this.clave() });
      this.mensaje.set(`Listo: ${cambiadas} ${cambiadas === 1 ? 'solicitud quedó' : 'solicitudes quedaron'} con la clave nueva. Díctasela por teléfono.`);
      this.clave.set('');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo asignar la clave.');
    } finally {
      this.ocupado.set(false);
    }
  }

  private limpiar(evento: Event, largo: number): string {
    const entrada = evento.target as HTMLInputElement;
    const limpia = soloDigitos(entrada.value).slice(0, largo);
    entrada.value = limpia;
    return limpia;
  }
}
